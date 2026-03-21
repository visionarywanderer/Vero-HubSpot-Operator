import { AsyncLocalStorage } from "async_hooks";
import db from "@/lib/db";
import { decryptText, encryptText } from "@/lib/crypto";
import {
  buildCapabilities,
  detectMissingScope,
  generateScopeUpgradeUrl,
  type PortalCapabilities,
} from "@/lib/hubspot-scopes";

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
  capabilities: PortalCapabilities;
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
  capabilities: PortalCapabilities;
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
  portalName?: string;
}

export interface ScopeUpgradeResult {
  error: "missing_scope";
  requiredScope: string;
  reconnectUrl: string;
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
  getCapabilities(portalId?: string): PortalCapabilities;
  hasScope(scope: string, portalId?: string): boolean;
  hasCapability(feature: keyof PortalCapabilities, portalId?: string): boolean;
  requireCapability(feature: keyof PortalCapabilities, portalId?: string): void;
  handleScopeError(error: unknown, portalId?: string): ScopeUpgradeResult | null;
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
  const scopes = row.scopes ? (JSON.parse(row.scopes) as string[]) : [];
  return {
    id: row.hub_id,
    name: row.name || `Hub ${row.hub_id}`,
    hubId: row.hub_id,
    token: row.access_token || "",
    refreshToken: row.refresh_token || undefined,
    expiresAt: row.expires_at || undefined,
    scopes,
    capabilities: buildCapabilities(scopes),
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
    capabilities: portal.capabilities,
    environment: portal.environment,
    createdAt: portal.createdAt,
    lastValidated: portal.lastValidated
  };
}

async function validateAndDetectScopes(token: string): Promise<{ ok: boolean; scopes: string[]; hubId: string; user?: string }> {
  const parseErrorDetail = async (resp: Response): Promise<string> => {
    try {
      const data = (await resp.json()) as { message?: string; category?: string };
      return [data.category, data.message].filter(Boolean).join(": ");
    } catch {
      return "";
    }
  };

  const contactsResp = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1&properties=email", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });

  if (contactsResp.status === 401) return { ok: false, scopes: [], hubId: "" };
  if (!contactsResp.ok) {
    const detail = await parseErrorDetail(contactsResp);
    if (contactsResp.status === 403) {
      throw new Error(detail ? `HubSpot token is missing required scopes (${detail})` : "HubSpot token is missing required scopes");
    }
    throw new Error(detail ? `HubSpot token validation failed (${detail})` : "HubSpot token validation failed");
  }

  if (token.startsWith("pat-")) {
    // Private app tokens can't be introspected via /oauth/v1/access-tokens
    return { ok: true, scopes: [], hubId: "" };
  }

  const scopeResp = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(token)}`, { cache: "no-store" });
  if (!scopeResp.ok) {
    const detail = await parseErrorDetail(scopeResp);
    throw new Error(detail ? `HubSpot scope detection failed (${detail})` : "HubSpot scope detection failed");
  }

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
  private refreshPromise: Promise<void> | null = null;
  private refreshCooldownUntil = 0;

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
    if (this.refreshPromise) return this.refreshPromise;
    if (Date.now() < this.refreshCooldownUntil) return;
    this.refreshPromise = this._doRefresh(portalId)
      .catch(() => {
        // Back off for 30s after a refresh failure to avoid hammering the token endpoint
        this.refreshCooldownUntil = Date.now() + 30_000;
      })
      .finally(() => {
        this.refreshPromise = null;
      });
    return this.refreshPromise;
  }

  private async _doRefresh(portalId?: string): Promise<void> {
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

    if (!tokenResp.ok) throw new Error("Token refresh failed");

    const tokenData = (await tokenResp.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!tokenData.access_token) throw new Error("Token refresh returned no access_token");

    // After refresh, re-introspect to get the latest granted scopes
    let newScopes = portal.scopes;
    try {
      const scopeResp = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(tokenData.access_token)}`, { cache: "no-store" });
      if (scopeResp.ok) {
        const scopeInfo = (await scopeResp.json()) as { scopes?: string[] };
        if (scopeInfo.scopes?.length) {
          newScopes = scopeInfo.scopes;
        }
      }
    } catch {
      // Keep existing scopes if introspection fails
    }

    db.prepare(
      "UPDATE portals SET access_token = ?, refresh_token = ?, expires_at = ?, scopes = ?, last_validated = ?, last_used = ? WHERE hub_id = ?"
    ).run(
      encryptText(tokenData.access_token),
      tokenData.refresh_token ? encryptText(tokenData.refresh_token) : portal.refreshToken,
      tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : portal.expiresAt || null,
      JSON.stringify(newScopes),
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
      name: input.portalName || `Hub ${input.hubId}`,
      accessTokenEnc: encryptText(input.accessToken),
      refreshTokenEnc: input.refreshToken ? encryptText(input.refreshToken) : undefined,
      expiresAt: input.expiresIn ? Date.now() + input.expiresIn * 1000 : undefined,
      scopes: input.scopes || [],
      installedBy: input.installedBy,
      environment: "production",
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

  getCapabilities(portalId?: string): PortalCapabilities {
    return this.getActivePortal(portalId).capabilities;
  }

  hasScope(scope: string, portalId?: string): boolean {
    return this.getScopes(portalId).includes(scope);
  }

  hasCapability(feature: keyof PortalCapabilities, portalId?: string): boolean {
    return this.getCapabilities(portalId)[feature];
  }

  requireCapability(feature: keyof PortalCapabilities, portalId?: string): void {
    if (!this.hasCapability(feature, portalId)) {
      throw new Error(`Feature "${feature}" is not available for this portal. The required scope was not granted.`);
    }
  }

  /**
   * Detect a missing scope from a HubSpot API error and generate a reauthorization URL.
   * Returns null if this is not a scope-related error.
   */
  handleScopeError(error: unknown, portalId?: string): ScopeUpgradeResult | null {
    const missingScope = detectMissingScope(error as Record<string, unknown>);
    if (!missingScope) return null;

    const clientId = process.env.HUBSPOT_OAUTH_CLIENT_ID;
    const redirectUri = process.env.HUBSPOT_OAUTH_REDIRECT_URI;
    if (!clientId || !redirectUri) return null;

    const portal = this.getActivePortal(portalId);
    const reconnectUrl = generateScopeUpgradeUrl(portal.scopes, missingScope, clientId, redirectUri);

    return {
      error: "missing_scope",
      requiredScope: missingScope,
      reconnectUrl
    };
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

    // Update stored scopes to reflect current granted scopes
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
