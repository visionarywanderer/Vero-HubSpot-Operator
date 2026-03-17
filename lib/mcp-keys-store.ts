/**
 * MCP API Key Store
 *
 * Manages API keys for external LLM clients (Claude, ChatGPT, etc.)
 * connecting to the MCP server. Each key is labeled with the
 * account/client it belongs to.
 *
 * Keys are stored in SQLite and validated by the MCP HTTP server.
 */

import db from "@/lib/db";
import { randomBytes, createHash } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpApiKey {
  id: string;
  label: string;             // e.g. "Claude Pro (personal)", "ChatGPT Team workspace"
  platform: "claude" | "chatgpt" | "other";
  key_prefix: string;        // First 8 chars for display: "mcp_a3f2..."
  key_hash: string;          // SHA-256 hash for validation
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

// The full key is only returned once at creation time
export interface McpApiKeyWithSecret extends McpApiKey {
  key: string;               // Full key — only shown once
}

// ---------------------------------------------------------------------------
// Table setup
// ---------------------------------------------------------------------------

function ensureTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mcp_api_keys (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'other',
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    )
  `);
}

let tableReady = false;
function init(): void {
  if (!tableReady) {
    ensureTable();
    tableReady = true;
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

class McpKeysStore {
  /**
   * Create a new API key. Returns the full key ONCE — it cannot be retrieved later.
   */
  create(label: string, platform: McpApiKey["platform"] = "other"): McpApiKeyWithSecret {
    init();
    const id = randomBytes(8).toString("hex");
    const rawKey = `mcp_${randomBytes(24).toString("hex")}`;
    const keyPrefix = rawKey.slice(0, 12) + "...";
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO mcp_api_keys (id, label, platform, key_prefix, key_hash, created_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    ).run(id, label, platform, keyPrefix, keyHash, now);

    return {
      id,
      label,
      platform,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      created_at: now,
      last_used_at: null,
      is_active: true,
      key: rawKey,
    };
  }

  /**
   * List all keys (without secrets).
   */
  list(): McpApiKey[] {
    init();
    type DbRow = Omit<McpApiKey, "is_active"> & { is_active: number };
    const rows = db.prepare(
      "SELECT id, label, platform, key_prefix, key_hash, created_at, last_used_at, is_active FROM mcp_api_keys ORDER BY created_at DESC"
    ).all() as DbRow[];

    return rows.map((r) => ({ ...r, is_active: Boolean(r.is_active) }));
  }

  /**
   * Validate a raw API key. Returns the key record if valid, null otherwise.
   */
  validate(rawKey: string): McpApiKey | null {
    init();
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    type DbRow = Omit<McpApiKey, "is_active"> & { is_active: number };
    const row = db.prepare(
      "SELECT id, label, platform, key_prefix, key_hash, created_at, last_used_at, is_active FROM mcp_api_keys WHERE key_hash = ? AND is_active = 1"
    ).get(keyHash) as DbRow | undefined;

    if (!row) return null;

    // Update last_used_at
    db.prepare("UPDATE mcp_api_keys SET last_used_at = ? WHERE id = ?").run(new Date().toISOString(), row.id);

    return { ...row, is_active: Boolean(row.is_active) };
  }

  /**
   * Revoke (deactivate) a key.
   */
  revoke(id: string): void {
    init();
    db.prepare("UPDATE mcp_api_keys SET is_active = 0 WHERE id = ?").run(id);
  }

  /**
   * Delete a key permanently.
   */
  delete(id: string): void {
    init();
    db.prepare("DELETE FROM mcp_api_keys WHERE id = ?").run(id);
  }

  /**
   * Update a key's label or platform.
   */
  update(id: string, updates: { label?: string; platform?: McpApiKey["platform"] }): void {
    init();
    if (updates.label !== undefined) {
      db.prepare("UPDATE mcp_api_keys SET label = ? WHERE id = ?").run(updates.label, id);
    }
    if (updates.platform !== undefined) {
      db.prepare("UPDATE mcp_api_keys SET platform = ? WHERE id = ?").run(updates.platform, id);
    }
  }
}

export const mcpKeysStore = new McpKeysStore();
