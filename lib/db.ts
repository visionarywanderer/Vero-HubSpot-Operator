import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import path from "path";

// Resolve project root: DATABASE_PATH env var (set by Claude Desktop config) > process.cwd()
// process.cwd() works in Next.js/Turbopack; DATABASE_PATH is needed for MCP STDIO (different cwd)
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "vero.db");
mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS portals (
    hub_id TEXT PRIMARY KEY,
    name TEXT,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    scopes TEXT,
    installed_by TEXT,
    installed_at TEXT,
    status TEXT DEFAULT 'connected',
    environment TEXT DEFAULT 'sandbox',
    last_used TEXT,
    created_at TEXT,
    last_validated TEXT
  );

  CREATE TABLE IF NOT EXISTS change_log (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    portal_id TEXT NOT NULL,
    layer TEXT,
    module TEXT,
    action TEXT,
    object_type TEXT,
    record_id TEXT,
    description TEXT,
    before_value TEXT,
    after_value TEXT,
    status TEXT,
    error TEXT,
    initiated_by TEXT,
    prompt TEXT
  );

  CREATE TABLE IF NOT EXISTS portal_config (
    portal_id TEXT PRIMARY KEY,
    config TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL,
    type TEXT NOT NULL,
    filename TEXT,
    content TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    role TEXT DEFAULT 'operator',
    added_at TEXT
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS script_metadata (
    id TEXT PRIMARY KEY,
    metadata TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS environments (
    name TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL,
    label TEXT,
    role TEXT CHECK(role IN ('development', 'staging', 'production')) NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS template_versions (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    version TEXT NOT NULL,
    description TEXT,
    resources TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT,
    UNIQUE(template_id, version)
  );

  CREATE TABLE IF NOT EXISTS deployment_snapshots (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL,
    template_id TEXT,
    template_version TEXT,
    resources_before TEXT,
    resources_deployed TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    rolled_back_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_changelog_portal ON change_log(portal_id);
  CREATE INDEX IF NOT EXISTS idx_changelog_timestamp ON change_log(timestamp);
  CREATE INDEX IF NOT EXISTS idx_artifacts_portal ON artifacts(portal_id);
  CREATE INDEX IF NOT EXISTS idx_template_versions_tid ON template_versions(template_id);
  CREATE INDEX IF NOT EXISTS idx_snapshots_portal ON deployment_snapshots(portal_id);
`);

export default db;
