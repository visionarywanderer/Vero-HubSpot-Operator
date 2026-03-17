/**
 * MCP OAuth Client Store
 *
 * Manages OAuth 2.1 clients for MCP connections (Claude Desktop, ChatGPT, etc.)
 * Each client gets a client_id + client_secret pair, plus handles
 * authorization codes and access tokens for the OAuth flow.
 *
 * Stored in SQLite alongside MCP API keys.
 */

import db from "@/lib/db";
import { randomBytes, createHash } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OAuthClient {
  id: string;
  client_id: string;
  client_secret_prefix: string;   // First 8 chars for display
  client_secret_hash: string;     // SHA-256 hash for validation
  label: string;
  platform: "claude_desktop" | "chatgpt" | "other";
  redirect_uris: string[];        // Registered redirect URIs
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

export interface OAuthClientWithSecret extends OAuthClient {
  client_secret: string;          // Full secret — only shown once
}

export interface OAuthAuthCode {
  code: string;
  client_id: string;
  code_challenge: string;         // PKCE
  code_challenge_method: string;  // S256
  redirect_uri: string;
  expires_at: number;
  used: boolean;
}

export interface OAuthAccessToken {
  token: string;
  token_hash: string;
  client_id: string;
  expires_at: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Table setup
// ---------------------------------------------------------------------------

function ensureTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL UNIQUE,
      client_secret_prefix TEXT NOT NULL,
      client_secret_hash TEXT NOT NULL,
      label TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'other',
      redirect_uris TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
      code TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      code_challenge TEXT NOT NULL,
      code_challenge_method TEXT NOT NULL DEFAULT 'S256',
      redirect_uri TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
      token_hash TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

let tablesReady = false;
function init(): void {
  if (!tablesReady) {
    ensureTables();
    tablesReady = true;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function sha256Base64url(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}

// ---------------------------------------------------------------------------
// OAuth Client CRUD
// ---------------------------------------------------------------------------

class McpOAuthStore {
  /**
   * Create a new OAuth client. Returns the client_secret ONCE.
   */
  createClient(label: string, platform: OAuthClient["platform"] = "other"): OAuthClientWithSecret {
    init();
    const id = randomBytes(8).toString("hex");
    const clientId = `mcp_${randomBytes(16).toString("hex")}`;
    const clientSecret = `mcs_${randomBytes(32).toString("hex")}`;
    const secretPrefix = clientSecret.slice(0, 12) + "...";
    const secretHash = sha256(clientSecret);
    const now = new Date().toISOString();

    // Claude Desktop uses a callback scheme — we'll accept anything for now
    const defaultRedirectUris = JSON.stringify(["http://localhost", "http://127.0.0.1"]);

    db.prepare(
      `INSERT INTO mcp_oauth_clients (id, client_id, client_secret_prefix, client_secret_hash, label, platform, redirect_uris, created_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(id, clientId, secretPrefix, secretHash, label, platform, defaultRedirectUris, now);

    return {
      id,
      client_id: clientId,
      client_secret_prefix: secretPrefix,
      client_secret_hash: secretHash,
      label,
      platform,
      redirect_uris: JSON.parse(defaultRedirectUris),
      created_at: now,
      last_used_at: null,
      is_active: true,
      client_secret: clientSecret,
    };
  }

  /**
   * List all OAuth clients (without secrets).
   */
  listClients(): OAuthClient[] {
    init();
    type DbRow = Omit<OAuthClient, "is_active" | "redirect_uris"> & { is_active: number; redirect_uris: string };
    const rows = db.prepare(
      "SELECT id, client_id, client_secret_prefix, client_secret_hash, label, platform, redirect_uris, created_at, last_used_at, is_active FROM mcp_oauth_clients ORDER BY created_at DESC"
    ).all() as DbRow[];

    return rows.map((r) => ({
      ...r,
      is_active: Boolean(r.is_active),
      redirect_uris: JSON.parse(r.redirect_uris),
    }));
  }

  /**
   * Validate client credentials. Returns client if valid.
   */
  validateClient(clientId: string, clientSecret: string): OAuthClient | null {
    init();
    const secretHash = sha256(clientSecret);
    type DbRow = Omit<OAuthClient, "is_active" | "redirect_uris"> & { is_active: number; redirect_uris: string };
    const row = db.prepare(
      "SELECT * FROM mcp_oauth_clients WHERE client_id = ? AND client_secret_hash = ? AND is_active = 1"
    ).get(clientId, secretHash) as DbRow | undefined;

    if (!row) return null;

    db.prepare("UPDATE mcp_oauth_clients SET last_used_at = ? WHERE id = ?").run(new Date().toISOString(), row.id);

    return {
      ...row,
      is_active: Boolean(row.is_active),
      redirect_uris: JSON.parse(row.redirect_uris),
    };
  }

  /**
   * Look up a client by client_id only (for authorization endpoint).
   */
  getClientById(clientId: string): OAuthClient | null {
    init();
    type DbRow = Omit<OAuthClient, "is_active" | "redirect_uris"> & { is_active: number; redirect_uris: string };
    const row = db.prepare(
      "SELECT * FROM mcp_oauth_clients WHERE client_id = ? AND is_active = 1"
    ).get(clientId) as DbRow | undefined;

    if (!row) return null;

    return {
      ...row,
      is_active: Boolean(row.is_active),
      redirect_uris: JSON.parse(row.redirect_uris),
    };
  }

  /**
   * Revoke (deactivate) a client.
   */
  revokeClient(id: string): void {
    init();
    db.prepare("UPDATE mcp_oauth_clients SET is_active = 0 WHERE id = ?").run(id);
  }

  /**
   * Delete a client and all its tokens/codes.
   */
  deleteClient(id: string): void {
    init();
    const client = db.prepare("SELECT client_id FROM mcp_oauth_clients WHERE id = ?").get(id) as { client_id: string } | undefined;
    if (client) {
      db.prepare("DELETE FROM mcp_oauth_codes WHERE client_id = ?").run(client.client_id);
      db.prepare("DELETE FROM mcp_oauth_tokens WHERE client_id = ?").run(client.client_id);
    }
    db.prepare("DELETE FROM mcp_oauth_clients WHERE id = ?").run(id);
  }

  // ── Authorization Codes ──────────────────────────────────────────────

  /**
   * Create an authorization code (PKCE-bound).
   */
  createAuthCode(clientId: string, codeChallenge: string, codeChallengeMethod: string, redirectUri: string): string {
    init();
    const code = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    db.prepare(
      `INSERT INTO mcp_oauth_codes (code, client_id, code_challenge, code_challenge_method, redirect_uri, expires_at, used)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    ).run(code, clientId, codeChallenge, codeChallengeMethod, redirectUri, expiresAt);

    return code;
  }

  /**
   * Exchange an authorization code for an access token.
   * Validates PKCE code_verifier.
   */
  exchangeCode(code: string, clientId: string, codeVerifier: string, redirectUri: string): { access_token: string; expires_in: number } | null {
    init();
    type CodeRow = { code: string; client_id: string; code_challenge: string; code_challenge_method: string; redirect_uri: string; expires_at: number; used: number };
    const row = db.prepare(
      "SELECT * FROM mcp_oauth_codes WHERE code = ? AND client_id = ? AND used = 0"
    ).get(code, clientId) as CodeRow | undefined;

    if (!row) return null;
    if (row.expires_at < Date.now()) return null;
    if (row.redirect_uri !== redirectUri) return null;

    // Validate PKCE
    const expectedChallenge = sha256Base64url(codeVerifier);
    if (expectedChallenge !== row.code_challenge) return null;

    // Mark code as used
    db.prepare("UPDATE mcp_oauth_codes SET used = 1 WHERE code = ?").run(code);

    // Create access token
    const accessToken = `mct_${randomBytes(32).toString("hex")}`;
    const tokenHash = sha256(accessToken);
    const expiresIn = 3600 * 24 * 30; // 30 days
    const expiresAt = Date.now() + expiresIn * 1000;

    db.prepare(
      `INSERT INTO mcp_oauth_tokens (token_hash, client_id, expires_at, created_at)
       VALUES (?, ?, ?, ?)`
    ).run(tokenHash, clientId, expiresAt, new Date().toISOString());

    return { access_token: accessToken, expires_in: expiresIn };
  }

  /**
   * Validate a Bearer token (from OAuth flow).
   */
  validateToken(token: string): OAuthClient | null {
    init();
    const tokenHash = sha256(token);
    type TokenRow = { token_hash: string; client_id: string; expires_at: number; created_at: string };
    const tokenRow = db.prepare(
      "SELECT * FROM mcp_oauth_tokens WHERE token_hash = ? AND expires_at > ?"
    ).get(tokenHash, Date.now()) as TokenRow | undefined;

    if (!tokenRow) return null;

    const client = this.getClientById(tokenRow.client_id);
    if (!client) return null;

    // Update last_used_at
    db.prepare("UPDATE mcp_oauth_clients SET last_used_at = ? WHERE client_id = ?").run(new Date().toISOString(), tokenRow.client_id);

    return client;
  }

  /**
   * Clean up expired codes and tokens.
   */
  cleanup(): void {
    init();
    const now = Date.now();
    db.prepare("DELETE FROM mcp_oauth_codes WHERE expires_at < ? OR used = 1").run(now);
    db.prepare("DELETE FROM mcp_oauth_tokens WHERE expires_at < ?").run(now);
  }
}

export const mcpOAuthStore = new McpOAuthStore();
