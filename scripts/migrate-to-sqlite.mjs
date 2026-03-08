#!/usr/bin/env node
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
import Database from "better-sqlite3";

const CWD = process.cwd();
const DB_PATH = process.env.DATABASE_PATH || path.join(CWD, "data", "vero.db");
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "";

if (!ENCRYPTION_KEY) {
  console.error("ENCRYPTION_KEY is required to migrate encrypted portal store");
  process.exit(1);
}

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

function key() {
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decrypt(ciphertext) {
  const [ivText, tagText, payloadText] = String(ciphertext || "").split(".");
  if (!ivText || !tagText || !payloadText) throw new Error("Invalid encrypted payload");
  const iv = Buffer.from(ivText, "base64url");
  const tag = Buffer.from(tagText, "base64url");
  const payload = Buffer.from(payloadText, "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8");
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

async function migratePortals() {
  const storeFile = path.join(os.homedir(), ".vero", "portals.enc");
  if (!exists(storeFile)) return { migrated: 0 };

  const encrypted = (await fsp.readFile(storeFile, "utf8")).trim();
  if (!encrypted) return { migrated: 0 };

  const raw = decrypt(encrypted);
  const parsed = JSON.parse(raw);
  const portals = Array.isArray(parsed?.portals) ? parsed.portals : [];

  const stmt = db.prepare(`
    INSERT INTO portals(
      hub_id, name, refresh_token, access_token, expires_at, scopes, installed_by, installed_at,
      status, environment, last_used, created_at, last_validated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connected', ?, ?, ?, ?)
    ON CONFLICT(hub_id) DO UPDATE SET
      name = excluded.name,
      refresh_token = COALESCE(excluded.refresh_token, portals.refresh_token),
      access_token = COALESCE(excluded.access_token, portals.access_token),
      expires_at = COALESCE(excluded.expires_at, portals.expires_at),
      scopes = excluded.scopes,
      installed_by = COALESCE(excluded.installed_by, portals.installed_by),
      environment = excluded.environment,
      last_used = excluded.last_used,
      last_validated = excluded.last_validated
  `);

  let count = 0;
  const now = new Date().toISOString();
  for (const p of portals) {
    const hubId = String(p.hubId || p.id || "");
    if (!hubId) continue;

    stmt.run(
      hubId,
      String(p.name || `Hub ${hubId}`),
      p.refreshToken ? encrypt(String(p.refreshToken)) : null,
      p.token ? encrypt(String(p.token)) : null,
      null,
      JSON.stringify(Array.isArray(p.scopes) ? p.scopes : []),
      null,
      now,
      p.environment === "production" ? "production" : "sandbox",
      now,
      String(p.createdAt || now),
      String(p.lastValidated || now)
    );
    count++;
  }

  return { migrated: count };
}

async function migratePortalConfig() {
  const configDir = path.join(CWD, "config", "portals");
  if (!exists(configDir)) return { migrated: 0 };

  const files = (await fsp.readdir(configDir)).filter((f) => f.endsWith(".json"));
  const stmt = db.prepare(
    "INSERT INTO portal_config(portal_id, config) VALUES(?, ?) ON CONFLICT(portal_id) DO UPDATE SET config = excluded.config"
  );

  let count = 0;
  for (const file of files) {
    const portalId = file.replace(/\.json$/, "");
    const raw = await fsp.readFile(path.join(configDir, file), "utf8");
    stmt.run(portalId, raw);
    count++;
  }
  return { migrated: count };
}

async function migrateAppSettings() {
  const file = path.join(CWD, "config", "app-settings.json");
  if (!exists(file)) return { migrated: 0 };

  const raw = await fsp.readFile(file, "utf8");
  const settings = JSON.parse(raw);

  const upsert = db.prepare(
    "INSERT INTO app_settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  for (const key of ["routingModel", "generationModel", "promptCaching", "monthlySpendLimit"]) {
    if (settings[key] !== undefined) {
      upsert.run(key, JSON.stringify(settings[key]));
    }
  }

  if (Array.isArray(settings.usersAllowlist)) {
    db.prepare("DELETE FROM users").run();
    const ins = db.prepare("INSERT OR IGNORE INTO users(email, role, added_at) VALUES(?, 'operator', ?)");
    const now = new Date().toISOString();
    for (const email of settings.usersAllowlist) {
      const normalized = String(email).trim().toLowerCase();
      if (normalized) ins.run(normalized, now);
    }
  }

  return { migrated: 1 };
}

async function migrateLogs() {
  const logsRoot = path.join(CWD, "logs");
  if (!exists(logsRoot)) return { migrated: 0 };

  const insert = db.prepare(`
    INSERT OR IGNORE INTO change_log(
      id, timestamp, portal_id, layer, module, action, object_type, record_id,
      description, before_value, after_value, status, error, initiated_by, prompt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  const portals = await fsp.readdir(logsRoot).catch(() => []);
  for (const portal of portals) {
    const dir = path.join(logsRoot, portal);
    const stat = await fsp.stat(dir).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const files = (await fsp.readdir(dir)).filter((f) => f.endsWith(".jsonl"));
    for (const file of files) {
      const content = await fsp.readFile(path.join(dir, file), "utf8");
      for (const line of content.split("\n").filter(Boolean)) {
        let entry;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }

        insert.run(
          entry.id || crypto.randomUUID(),
          entry.timestamp || new Date().toISOString(),
          entry.portalId || portal,
          entry.layer || null,
          entry.module || null,
          entry.action || null,
          entry.objectType || null,
          entry.recordId || null,
          entry.description || "",
          entry.before ? JSON.stringify(entry.before) : null,
          entry.after ? JSON.stringify(entry.after) : null,
          entry.status || "success",
          entry.error || null,
          entry.initiatedBy || "migration",
          entry.prompt || null
        );
        count++;
      }
    }
  }
  return { migrated: count };
}

async function migrateArtifacts() {
  const artifactsRoot = path.join(CWD, "artifacts");
  if (!exists(artifactsRoot)) return { migrated: 0 };

  const insert = db.prepare(
    "INSERT INTO artifacts(id, portal_id, type, filename, content, created_at) VALUES(?, ?, ?, ?, ?, ?)"
  );

  let count = 0;
  const portals = await fsp.readdir(artifactsRoot).catch(() => []);
  for (const portalId of portals) {
    const portalDir = path.join(artifactsRoot, portalId);
    const stat = await fsp.stat(portalDir).catch(() => null);
    if (!stat?.isDirectory()) continue;

    for (const type of ["workflows", "scripts"]) {
      const dir = path.join(portalDir, type);
      if (!exists(dir)) continue;
      const files = await fsp.readdir(dir);
      for (const file of files) {
        const full = path.join(dir, file);
        const content = await fsp.readFile(full, "utf8").catch(() => "");
        const createdAt = new Date((await fsp.stat(full)).mtimeMs).toISOString();
        insert.run(crypto.randomUUID(), portalId, type, file, content, createdAt);
        count++;
      }
    }
  }

  return { migrated: count };
}

async function main() {
  const results = {
    portals: await migratePortals(),
    portalConfig: await migratePortalConfig(),
    appSettings: await migrateAppSettings(),
    logs: await migrateLogs(),
    artifacts: await migrateArtifacts()
  };

  console.log("Migration complete:");
  console.table(results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
