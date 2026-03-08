import { AsyncLocalStorage } from "async_hooks";
import db from "@/lib/db";
import { decryptText, encryptText } from "@/lib/crypto";

type PortalContext = { portalId: string };
const portalContext = new AsyncLocalStorage<PortalContext>();

export interface PortalConfig {
  id: string;
  name: string;
  hubId: string;
  token: string;
  refreshToken?: string;
  expiresAt?: number;
  scopes: string[];
  installedBy?: string;
  environment: "production" | "sandbox";
  createdAt: string;
  lastValidated: string;
}

export interface PortalSummary {
  id: string;
  name: string;
  hubId: string;
  scopes: string[];
  environment: "production" | "sandbox";
  createdAt: string;
  lastValidated: string;
}

export interface OAuthCallbackInput {
  hubId: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scopes?: string[];
  installedBy?: string;
}

export interface AuthManager {
  addPortal(config: PortalConfig): Promise<void>;
  handleCallback(input: OAuthCallbackInput): Promise<void>;
  removePortal(portalId: string): Promise<void>;
  listPortals(): PortalSummary[];
  setActivePortal(portalId: string): void;
  getActivePortal(portalId?: string): PortalConfig;
  getToken(portalId?: string): string;
  getScopes(portalId?: string): string[];
  hasScope(scope: string, portalId?: string): boolean;
  validateToken(portalId?: string): Promise<boolean>;
  isFirstSessionForActivePortal(portalId?: string): boolean;
  ensureValidatedForSession(portalId?: string): Promise<void>;
  startupValidate(): Promise<void>;
  withPortal<T>(portalId: string, fn: () => Promise<T>): Promise<T>;
}

type PortalRow = {
  hub_id: string;
  name: string | null;
  refresh_token: string | null;
  access_token: string | null;
  expires_at: number | null;
  scopes: string | null;
  installed_by: string | null;
  installed_at: string | null;
  status: string | null;
  environment: string | null;
  created_at: string | null;
  last_validated: string | null;
};

function rowToPortal(row: PortalRow): PortalConfig {
  return {
    id: row.hub_id,
    name: row.name || `Hub ${row.hub_id}`,
    hubId: row.hub_id,
    token: row.access_token || "",
    refreshToken: row.refresh_token || undefined,
    expiresAt: row.expires_at || undefined,
    scopes: row.scopes ? (JSON.parse(row.scopes) as string[]) : [],
    installedBy: row.installed_by || undefined,
    environment: row.environment === "production" ? "production" : "sandbox",
    createdAt: row.created_at || new Date().toISOString(),
    lastValidated: row.last_validated || "never"
  };
}

function summaryFromPortal(portal: PortalConfig): PortalSummary {
  return {
    id: portal.id,
    name: portal.name,
    hubId: portal.hubId,
    scopes: portal.scopes,
    environment: portal.environment,
    createdAt: portal.createdAt,
    lastValidated: portal.lastValidated
  };
}

async function validateAndDetectScopes(token: string): Promise<{ ok: boolean; scopes: string[]; hubId: string; user?: string }> {
  const contactsResp = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });

  if (contactsResp.status === 401) return { ok: false, scopes: [], hubId: "" };
  if (!contactsResp.ok) throw new Error("HubSpot token validation failed");

  const scopeResp = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${token}`, { cache: "no-store" });
  if (!scopeResp.ok) throw new Error("HubSpot scope detection failed");

  const tokenInfo = (await scopeResp.json()) as {
    scopes?: string[];
    hub_id?: number;
    user?: string;
  };

  return {
    ok: true,
    scopes: tokenInfo.scopes ?? [],
    hubId: tokenInfo.hub_id ? String(tokenInfo.hub_id) : "",
    user: tokenInfo.user
  };
}

class SqliteAuthManager implements AuthManager {
  private validatedThisSession = new Set<string>();

  async withPortal<T>(portalId: string, fn: () => Promise<T>): Promise<T> {
    return portalContext.run({ portalId }, fn);
  }

  private resolvePortalId(explicitPortalId?: string): string | undefined {
    if (explicitPortalId) return explicitPortalId;
    return portalContext.getStore()?.portalId;
  }

  private getPortalRow(portalId?: string): PortalRow | undefined {
    const id = this.resolvePortalId(portalId);
    if (!id) return undefined;

    return db.prepare("SELECT * FROM portals WHERE hub_id = ?").get(id) as PortalRow | undefined;
  }

  private savePortal(portal: {
    hubId: string;
    name: string;
    accessTokenEnc?: string;
    refreshTokenEnc?: string;
    expiresAt?: number;
    scopes: string[];
    installedBy?: string;
    environment: "production" | "sandbox";
    createdAt?: string;
    lastValidated?: string;
  }): void {
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO portals(
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
        status = 'connected',
        environment = excluded.environment,
        last_used = excluded.last_used,
        last_validated = excluded.last_validated`
    ).run(
      portal.hubId,
      portal.name,
      portal.refreshTokenEnc || null,
      portal.accessTokenEnc || null,
      portal.expiresAt || null,
      JSON.stringify(portal.scopes || []),
      portal.installedBy || null,
      now,
      portal.environment,
      now,
      portal.createdAt || now,
      portal.lastValidated || now
    );
  }

  private async refreshTokenIfNeeded(portalId?: string): Promise<void> {
    const portal = this.getActivePortal(portalId);
    if (!portal.refreshToken || !portal.expiresAt || Date.now() < portal.expiresAt - 60_000) {
      return;
    }

    const clientId = process.env.HUBSPOT_OAUTH_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.HUBSPOT_OAUTH_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) return;

    const refreshToken = decryptText(portal.refreshToken);
    const tokenResp = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        refresh_token: refreshToken
      }),
      cache: "no-store"
    });

    if (!tokenResp.ok) return;

    const tokenData = (await tokenResp.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!tokenData.access_token) return;

    db.prepare(
      "UPDATE portals SET access_token = ?, refresh_token = ?, expires_at = ?, last_validated = ?, last_used = ? WHERE hub_id = ?"
    ).run(
      encryptText(tokenData.access_token),
      tokenData.refresh_token ? encryptText(tokenData.refresh_token) : portal.refreshToken,
      tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : portal.expiresAt || null,
      new Date().toISOString(),
      new Date().toISOString(),
      portal.hubId
    );
  }

  async addPortal(config: PortalConfig): Promise<void> {
    const token = config.token.trim();
    if (!token) throw new Error("Token is required");

    const validation = await validateAndDetectScopes(token);
    if (!validation.ok) throw new Error("Invalid HubSpot token");

    const hubId = validation.hubId || config.hubId || config.id;
    this.savePortal({
      hubId,
      name: config.name,
      accessTokenEnc: encryptText(token),
      refreshTokenEnc: config.refreshToken,
      expiresAt: config.expiresAt,
      scopes: validation.scopes,
      installedBy: validation.user,
      environment: config.environment,
      createdAt: config.createdAt,
      lastValidated: new Date().toISOString()
    });

    this.validatedThisSession.add(hubId);
  }

  async handleCallback(input: OAuthCallbackInput): Promise<void> {
    this.savePortal({
      hubId: String(input.hubId),
      name: `Hub ${input.hubId}`,
      accessTokenEnc: encryptText(input.accessToken),
      refreshTokenEnc: input.refreshToken ? encryptText(input.refreshToken) : undefined,
      expiresAt: input.expiresIn ? Date.now() + input.expiresIn * 1000 : undefined,
      scopes: input.scopes || [],
      installedBy: input.installedBy,
      environment: "sandbox",
      lastValidated: new Date().toISOString()
    });

    this.validatedThisSession.add(String(input.hubId));
  }

  async removePortal(portalId: string): Promise<void> {
    db.prepare("DELETE FROM portals WHERE hub_id = ?").run(portalId);
    this.validatedThisSession.delete(portalId);
  }

  listPortals(): PortalSummary[] {
    const rows = db
      .prepare("SELECT * FROM portals WHERE status = 'connected' ORDER BY COALESCE(last_used, installed_at, created_at) DESC")
      .all() as PortalRow[];
    return rows.map((row) => summaryFromPortal(rowToPortal(row)));
  }

  setActivePortal(portalId: string): void {
    void portalId;
  }

  getActivePortal(portalId?: string): PortalConfig {
    const row = this.getPortalRow(portalId);
    if (!row) throw new Error("No portal selected");

    const portal = rowToPortal(row);
    db.prepare("UPDATE portals SET last_used = ? WHERE hub_id = ?").run(new Date().toISOString(), portal.hubId);
    return portal;
  }

  getToken(portalId?: string): string {
    const portal = this.getActivePortal(portalId);

    if (!portal.token) {
      const envToken = process.env.HUBSPOT_TOKEN;
      if (envToken) return envToken;
      throw new Error("Portal token not available");
    }

    return decryptText(portal.token);
  }

  getScopes(portalId?: string): string[] {
    return this.getActivePortal(portalId).scopes;
  }

  hasScope(scope: string, portalId?: string): boolean {
    return this.getScopes(portalId).includes(scope);
  }

  isFirstSessionForActivePortal(portalId?: string): boolean {
    const active = this.getActivePortal(portalId);
    return !this.validatedThisSession.has(active.id);
  }

  async validateToken(portalId?: string): Promise<boolean> {
    await this.refreshTokenIfNeeded(portalId);

    const active = this.getActivePortal(portalId);
    const token = this.getToken(portalId);
    const validation = await validateAndDetectScopes(token);
    if (!validation.ok) return false;

    db.prepare("UPDATE portals SET scopes = ?, last_validated = ? WHERE hub_id = ?").run(
      JSON.stringify(validation.scopes),
      new Date().toISOString(),
      active.hubId
    );

    this.validatedThisSession.add(active.id);
    return true;
  }

  async ensureValidatedForSession(portalId?: string): Promise<void> {
    await this.refreshTokenIfNeeded(portalId);

    const active = this.getActivePortal(portalId);
    if (this.validatedThisSession.has(active.id)) return;

    const ok = await this.validateToken(portalId);
    if (!ok) throw new Error("Invalid HubSpot token");
  }

  async startupValidate(): Promise<void> {
    const portals = this.listPortals();
    if (!portals.length) return;

    try {
      await this.ensureValidatedForSession(portals[0].id);
    } catch {
      // Keep startup resilient; route handlers surface explicit errors.
    }
  }
}

export const authManager = new SqliteAuthManager();
