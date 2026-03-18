import { authManager } from "@/lib/auth-manager";
import { changeLogger, type ChangeAction } from "@/lib/change-logger";
import { detectMissingScope, generateScopeUpgradeUrl } from "@/lib/hubspot-scopes";

const HUBSPOT_BASE_URL = "https://api.hubapi.com";
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 404, 409]);

type Json = Record<string, unknown>;

export interface HubSpotError {
  statusCode: number;
  category: string;
  message: string;
  correlationId: string;
  context?: object;
  /** Present when the error is a missing scope — contains the URL to re-authorize */
  scopeUpgradeUrl?: string;
  /** The specific scope that was missing */
  missingScope?: string;
}

export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
}

export interface CrmRecord {
  id: string;
  properties: Record<string, string | null>;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
}

export interface Filter {
  propertyName: string;
  operator: string;
  value?: string;
  values?: string[];
}

export interface FilterGroup {
  filters: Filter[];
}

export interface BatchResult {
  successes: unknown[];
  errors: Array<{ batch: number; error: string }>;
}

export interface HubSpotClient {
  get(path: string, params?: object): Promise<ApiResponse>;
  post(path: string, body: object): Promise<ApiResponse>;
  put(path: string, body: object): Promise<ApiResponse>;
  patch(path: string, body: object): Promise<ApiResponse>;
  delete(path: string): Promise<ApiResponse>;
  paginate<T = Json>(path: string, params?: object): AsyncGenerator<T[]>;
  batchProcess<T>(items: T[], processFn: (batch: T[]) => Promise<unknown[]>, batchSize?: number): Promise<BatchResult>;
}

export interface ApiClient {
  crm: {
    get(objectType: string, id: string, properties?: string[]): Promise<CrmRecord>;
    search(objectType: string, filters: FilterGroup[], properties?: string[]): AsyncGenerator<CrmRecord[]>;
    create(objectType: string, properties: object): Promise<CrmRecord>;
    update(objectType: string, id: string, properties: object): Promise<CrmRecord>;
    delete(objectType: string, id: string): Promise<void>;
    batchCreate(objectType: string, records: object[]): Promise<BatchResult>;
    batchUpdate(objectType: string, records: { id: string; properties: object }[]): Promise<BatchResult>;
    batchUpsert(objectType: string, records: object[], idProperty?: string): Promise<BatchResult>;
    batchRead(objectType: string, ids: string[], properties?: string[], idProperty?: string): Promise<BatchResult>;
  };
  properties: {
    list(objectType: string): Promise<ApiResponse>;
    create(objectType: string, body: object): Promise<ApiResponse>;
    update(objectType: string, name: string, body: object): Promise<ApiResponse>;
    delete(objectType: string, name: string): Promise<ApiResponse>;
  };
  associations: {
    list(type: string, id: string, toType: string): Promise<ApiResponse>;
    create(type: string, id: string, toType: string, toId: string): Promise<ApiResponse>;
    batchCreate(fromType: string, toType: string, pairs: Array<{ fromId: string; toId: string }>): Promise<BatchResult>;
  };
  pipelines: {
    list(objectType: string): Promise<ApiResponse>;
    create(objectType: string, body: object): Promise<ApiResponse>;
  };
  workflows: {
    list(): Promise<ApiResponse>;
    create(body: object): Promise<ApiResponse>;
    update(flowId: string, body: object): Promise<ApiResponse>;
    delete(flowId: string): Promise<ApiResponse>;
  };
  lists: {
    list(): Promise<ApiResponse>;
    create(body: object): Promise<ApiResponse>;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function currentPortalId(): string {
  try {
    return authManager.getActivePortal().id;
  } catch {
    return "unknown-portal";
  }
}

async function safeLog(input: {
  layer: "mcp" | "api" | "script";
  module: string;
  action: ChangeAction;
  objectType: string;
  recordId: string;
  description: string;
  before?: object;
  after?: object;
  status: "success" | "error" | "dry_run";
  error?: string;
  initiatedBy?: string;
  prompt?: string;
}): Promise<void> {
  try {
    await changeLogger.log({
      portalId: currentPortalId(),
      layer: input.layer,
      module: input.module,
      action: input.action,
      objectType: input.objectType,
      recordId: input.recordId,
      description: input.description,
      before: input.before,
      after: input.after,
      status: input.status,
      error: input.error,
      initiatedBy: input.initiatedBy ?? "user",
      prompt: input.prompt
    });
  } catch {
    // Never block API operations on logger failures.
  }
}

class RateLimiter {
  private tokens = 100;
  private lastRefill = Date.now();
  private readonly recentRequestTimestamps: number[] = [];
  private globalPauseUntil = 0;
  private readonly recentSearchRequestTimestamps: number[] = [];

  async acquire(isSearchEndpoint: boolean): Promise<void> {
    await this.waitForGlobalPause();

    while (true) {
      this.refillTokens();
      this.pruneOldTimestamps();

      if (this.tokens <= 0) {
        await sleep(100);
        continue;
      }

      if (this.recentRequestTimestamps.length >= 100) {
        const oldest = this.recentRequestTimestamps[0];
        const waitMs = Math.max(0, oldest + 10_000 - Date.now());
        await sleep(waitMs || 100);
        continue;
      }

      if (isSearchEndpoint) {
        this.pruneOldSearchTimestamps();
        if (this.recentSearchRequestTimestamps.length >= 4) {
          const oldestSearch = this.recentSearchRequestTimestamps[0];
          const waitMs = Math.max(0, oldestSearch + 1_000 - Date.now());
          await sleep(waitMs || 100);
          continue;
        }

        this.recentSearchRequestTimestamps.push(Date.now());
      }

      this.tokens -= 1;
      this.recentRequestTimestamps.push(Date.now());
      return;
    }
  }

  pauseAll(retryAfterSeconds: number): void {
    const ms = Math.max(1, retryAfterSeconds) * 1000;
    this.globalPauseUntil = Math.max(this.globalPauseUntil, Date.now() + ms);
  }

  private async waitForGlobalPause(): Promise<void> {
    const waitMs = this.globalPauseUntil - Date.now();
    if (waitMs > 0) {
      await sleep(waitMs);
    }
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(100, this.tokens + elapsedSeconds * 10);
    this.lastRefill = now;
  }

  private pruneOldTimestamps(): void {
    const cutoff = Date.now() - 10_000;
    while (this.recentRequestTimestamps.length > 0 && this.recentRequestTimestamps[0] < cutoff) {
      this.recentRequestTimestamps.shift();
    }
  }

  private pruneOldSearchTimestamps(): void {
    const cutoff = Date.now() - 1_000;
    while (this.recentSearchRequestTimestamps.length > 0 && this.recentSearchRequestTimestamps[0] < cutoff) {
      this.recentSearchRequestTimestamps.shift();
    }
  }
}

export class HubSpotApiError extends Error implements HubSpotError {
  statusCode: number;
  category: string;
  correlationId: string;
  context?: object;
  scopeUpgradeUrl?: string;
  missingScope?: string;

  constructor(normalized: HubSpotError) {
    super(normalized.message);
    this.statusCode = normalized.statusCode;
    this.category = normalized.category;
    this.correlationId = normalized.correlationId;
    this.context = normalized.context;
    this.scopeUpgradeUrl = normalized.scopeUpgradeUrl;
    this.missingScope = normalized.missingScope;
  }
}

class BaseHubSpotClient implements HubSpotClient {
  private readonly limiter = new RateLimiter();

  async get(pathname: string, params?: object): Promise<ApiResponse> {
    return this.request("GET", pathname, params);
  }

  async post(pathname: string, body: object): Promise<ApiResponse> {
    return this.request("POST", pathname, body);
  }

  async put(pathname: string, body: object): Promise<ApiResponse> {
    return this.request("PUT", pathname, body);
  }

  async patch(pathname: string, body: object): Promise<ApiResponse> {
    return this.request("PATCH", pathname, body);
  }

  async delete(pathname: string): Promise<ApiResponse> {
    return this.request("DELETE", pathname);
  }

  async *paginate<T = Json>(pathname: string, params?: object): AsyncGenerator<T[]> {
    let after: string | undefined;

    do {
      const query = {
        ...(params ?? {}),
        ...(after ? { after } : {}),
        limit: 100
      };
      const response = await this.get(pathname, query);
      const data = response.data as { results?: T[]; paging?: { next?: { after?: string } } };
      yield data.results ?? [];
      after = data.paging?.next?.after;
    } while (after);
  }

  async batchProcess<T>(
    items: T[],
    processFn: (batch: T[]) => Promise<unknown[]>,
    batchSize = 100
  ): Promise<BatchResult> {
    const safeBatchSize = Math.max(1, Math.min(100, batchSize));
    const results: BatchResult = { successes: [], errors: [] };

    for (let i = 0; i < items.length; i += safeBatchSize) {
      const batch = items.slice(i, i + safeBatchSize);
      try {
        const output = await processFn(batch);
        results.successes.push(...output);
      } catch (error) {
        results.errors.push({
          batch: Math.floor(i / safeBatchSize),
          error: error instanceof Error ? error.message : "Batch processing failed"
        });
      }
    }

    return results;
  }

  private async request(method: string, pathname: string, payload?: object, retryAttempt = 0): Promise<ApiResponse> {
    const isSearchEndpoint = pathname.includes("/search");
    await this.limiter.acquire(isSearchEndpoint);
    await authManager.ensureValidatedForSession();

    const token = authManager.getToken();
    const url = new URL(`${HUBSPOT_BASE_URL}${pathname}`);

    // SSRF guard: ensure the resolved URL stays on the HubSpot API domain
    if (url.origin !== new URL(HUBSPOT_BASE_URL).origin) {
      throw new HubSpotApiError({
        statusCode: 400,
        category: "SSRF_BLOCKED",
        message: `Request blocked: URL resolves to ${url.origin}, expected ${new URL(HUBSPOT_BASE_URL).origin}`,
        correlationId: "local-ssrf-guard",
      });
    }

    if (method === "GET" && payload) {
      const params = payload as Record<string, unknown>;
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) {
          continue;
        }
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(payload ?? {}),
      cache: "no-store"
    });

    // --- Deprecation header detection (self-improving) ---
    logDeprecationHeaders(response, pathname);

    if (response.ok) {
      if (response.status === 204) {
        return { status: response.status, data: {} };
      }

      const data = (await response.json()) as unknown;
      return { status: response.status, data };
    }

    const retryAfter = Number(response.headers.get("retry-after") || "10");
    if (response.status === 429) {
      this.limiter.pauseAll(Number.isNaN(retryAfter) ? 10 : retryAfter);
    }

    if (RETRYABLE_STATUS_CODES.has(response.status) && retryAttempt < 3) {
      if (response.status === 429) {
        await sleep((Number.isNaN(retryAfter) ? 10 : retryAfter) * 1000);
      } else {
        const delay = Math.pow(2, retryAttempt) * 1000;
        await sleep(delay);
      }
      return this.request(method, pathname, payload, retryAttempt + 1);
    }

    if (NON_RETRYABLE_STATUS_CODES.has(response.status) || retryAttempt >= 3) {
      const normalized = await normalizeError(response);
      throw new HubSpotApiError(normalized);
    }

    const normalized = await normalizeError(response);
    throw new HubSpotApiError(normalized);
  }
}

async function normalizeError(response: Response): Promise<HubSpotError> {
  const fallback: HubSpotError = {
    statusCode: response.status,
    category: "UNKNOWN_ERROR",
    message: "HubSpot request failed",
    correlationId: response.headers.get("x-hubspot-correlation-id") || "unknown"
  };

  try {
    const json = (await response.json()) as {
      category?: string;
      message?: string;
      correlationId?: string;
      context?: object;
    };

    const normalized: HubSpotError = {
      statusCode: response.status,
      category: json.category || fallback.category,
      message: json.message || fallback.message,
      correlationId: json.correlationId || fallback.correlationId,
      context: json.context
    };

    // Self-healing: detect missing scope on 403 and attach reauthorization URL
    if (response.status === 403) {
      const missing = detectMissingScope({ statusCode: 403, message: json.message });
      if (missing) {
        normalized.missingScope = missing;
        const clientId = process.env.HUBSPOT_OAUTH_CLIENT_ID;
        const redirectUri = process.env.HUBSPOT_OAUTH_REDIRECT_URI;
        if (clientId && redirectUri) {
          try {
            const scopes = authManager.getScopes();
            normalized.scopeUpgradeUrl = generateScopeUpgradeUrl(scopes, missing, clientId, redirectUri);
          } catch {
            // If we can't get current scopes, skip the upgrade URL
          }
        }
      }
    }

    return normalized;
  } catch {
    return fallback;
  }
}

/**
 * Detect and log HubSpot deprecation/sunset headers.
 * These indicate upcoming breaking changes that need attention.
 * Logs to change_log for visibility and persists to app_settings for the health check.
 */
function logDeprecationHeaders(response: Response, pathname: string): void {
  try {
    const deprecation = response.headers.get("deprecation") || response.headers.get("x-deprecation");
    const sunset = response.headers.get("sunset");
    const link = response.headers.get("link"); // Often contains successor URL

    if (!deprecation && !sunset) return;

    const warning = {
      endpoint: pathname,
      deprecation: deprecation || undefined,
      sunset: sunset || undefined,
      successor: link || undefined,
      detectedAt: new Date().toISOString(),
    };

    // Log to change_log for audit trail
    safeLog({
      layer: "api",
      module: "deprecation-detector",
      action: "audit",
      objectType: "api_endpoint",
      recordId: pathname,
      description: `API deprecation detected: ${pathname}${sunset ? ` (sunset: ${sunset})` : ""}`,
      after: warning,
      status: "success",
      initiatedBy: "system",
    });

    // Persist to app_settings for the deep health check to read
    const dbModule = require("@/lib/db");
    const dbInstance = dbModule.default;
    const key = "deprecation_warnings";
    const existing = dbInstance.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined;
    const warnings: object[] = existing ? JSON.parse(existing.value) : [];

    // Avoid duplicate warnings for the same endpoint
    const isDuplicate = warnings.some(
      (w) => (w as Record<string, unknown>).endpoint === pathname && (w as Record<string, unknown>).deprecation === deprecation
    );
    if (!isDuplicate) {
      warnings.push(warning);
      // Keep only last 50 warnings
      const trimmed = warnings.slice(-50);
      dbInstance.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(
        key,
        JSON.stringify(trimmed)
      );
    }
  } catch {
    // Never block API operations on deprecation logging failures
  }
}

class HubSpotApiClient implements ApiClient {
  private readonly base = new BaseHubSpotClient();

  crm = {
    get: async (objectType: string, id: string, properties?: string[]): Promise<CrmRecord> => {
      const params = properties?.length ? { properties: properties.join(",") } : undefined;
      const response = await this.base.get(`/crm/v3/objects/${objectType}/${id}`, params);
      return response.data as CrmRecord;
    },

    search: async function* (
      this: HubSpotApiClient,
      objectType: string,
      filters: FilterGroup[],
      properties?: string[]
    ): AsyncGenerator<CrmRecord[]> {
      let after: string | undefined;
      do {
        const response = await this.base.post(`/crm/v3/objects/${objectType}/search`, {
          filterGroups: filters,
          properties: properties ?? [],
          limit: 100,
          after
        });

        const data = response.data as { results?: CrmRecord[]; paging?: { next?: { after?: string } } };
        yield data.results ?? [];
        after = data.paging?.next?.after;
      } while (after);
    }.bind(this),

    create: async (objectType: string, properties: object): Promise<CrmRecord> => {
      try {
        const response = await this.base.post(`/crm/v3/objects/${objectType}`, { properties });
        const record = response.data as CrmRecord;

        await safeLog({
          layer: "api",
          module: "A2",
          action: "create",
          objectType,
          recordId: record.id,
          description: `Created ${objectType} ${record.id}`,
          after: record,
          status: "success"
        });

        return record;
      } catch (error) {
        await safeLog({
          layer: "api",
          module: "A2",
          action: "create",
          objectType,
          recordId: "unknown",
          description: `Failed to create ${objectType}`,
          status: "error",
          error: error instanceof Error ? error.message : "create failed"
        });
        throw error;
      }
    },

    update: async (objectType: string, id: string, properties: object): Promise<CrmRecord> => {
      // Only fetch the properties we're about to update for the before-snapshot
      const updateKeys = Object.keys(properties);
      let before: CrmRecord | null = null;
      try {
        before = await this.crm.get(objectType, id, updateKeys.length ? updateKeys : undefined);
      } catch {
        before = null;
      }

      try {
        const response = await this.base.patch(`/crm/v3/objects/${objectType}/${id}`, { properties });
        const record = response.data as CrmRecord;

        await safeLog({
          layer: "api",
          module: "A3",
          action: "update",
          objectType,
          recordId: id,
          description: `Updated ${objectType} ${id}`,
          before: before ?? undefined,
          after: record,
          status: "success"
        });

        return record;
      } catch (error) {
        await safeLog({
          layer: "api",
          module: "A3",
          action: "update",
          objectType,
          recordId: id,
          description: `Failed to update ${objectType} ${id}`,
          before: before ?? undefined,
          after: properties as object,
          status: "error",
          error: error instanceof Error ? error.message : "update failed"
        });
        throw error;
      }
    },

    delete: async (objectType: string, id: string): Promise<void> => {
      // Only fetch minimal identifying properties for the before-snapshot
      let before: CrmRecord | null = null;
      try {
        before = await this.crm.get(objectType, id, ["email", "firstname", "lastname", "dealname", "name", "subject"]);
      } catch {
        before = null;
      }

      try {
        await this.base.delete(`/crm/v3/objects/${objectType}/${id}`);
        await safeLog({
          layer: "api",
          module: "A7",
          action: "delete",
          objectType,
          recordId: id,
          description: `Deleted ${objectType} ${id}`,
          before: before ?? undefined,
          status: "success"
        });
      } catch (error) {
        await safeLog({
          layer: "api",
          module: "A7",
          action: "delete",
          objectType,
          recordId: id,
          description: `Failed to delete ${objectType} ${id}`,
          before: before ?? undefined,
          status: "error",
          error: error instanceof Error ? error.message : "delete failed"
        });
        throw error;
      }
    },

    batchCreate: async (objectType: string, records: object[]): Promise<BatchResult> => {
      const result = await this.base.batchProcess(records, async (batch) => {
        const response = await this.base.post(`/crm/v3/objects/${objectType}/batch/create`, {
          inputs: batch.map((properties) => ({ properties }))
        });

        const data = response.data as { results?: unknown[] };
        return data.results ?? [];
      });

      await safeLog({
        layer: "api",
        module: "F1",
        action: "create",
        objectType,
        recordId: `batch-${Date.now()}`,
        description: `Batch create ${records.length} ${objectType} records`,
        after: { successes: result.successes.length, errors: result.errors.length },
        status: result.errors.length ? "error" : "success"
      });

      return result;
    },

    batchUpdate: async (
      objectType: string,
      records: { id: string; properties: object }[]
    ): Promise<BatchResult> => {
      const result = await this.base.batchProcess(records, async (batch) => {
        const response = await this.base.post(`/crm/v3/objects/${objectType}/batch/update`, {
          inputs: batch
        });

        const data = response.data as { results?: unknown[] };
        return data.results ?? [];
      });

      await safeLog({
        layer: "api",
        module: "F1",
        action: "update",
        objectType,
        recordId: `batch-${Date.now()}`,
        description: `Batch update ${records.length} ${objectType} records`,
        after: { successes: result.successes.length, errors: result.errors.length },
        status: result.errors.length ? "error" : "success"
      });

      return result;
    },

    batchUpsert: async (objectType: string, records: object[], idProperty?: string): Promise<BatchResult> => {
      const result = await this.base.batchProcess(records, async (batch) => {
        const response = await this.base.post(`/crm/v3/objects/${objectType}/batch/upsert`, {
          inputs: batch.map((properties) => {
            const props = properties as Record<string, unknown>;
            return {
              properties: props,
              ...(idProperty ? { idProperty, id: props[idProperty] as string } : {}),
            };
          }),
        });
        const data = response.data as { results?: unknown[] };
        return data.results ?? [];
      });

      await safeLog({
        layer: "api",
        module: "F1",
        action: "update",
        objectType,
        recordId: `batch-upsert-${Date.now()}`,
        description: `Batch upsert ${records.length} ${objectType} records`,
        after: { successes: result.successes.length, errors: result.errors.length },
        status: result.errors.length ? "error" : "success",
      });

      return result;
    },

    batchRead: async (objectType: string, ids: string[], properties?: string[], idProperty?: string): Promise<BatchResult> => {
      const result = await this.base.batchProcess(ids, async (batch) => {
        const response = await this.base.post(`/crm/v3/objects/${objectType}/batch/read`, {
          inputs: batch.map((id) => ({ id })),
          properties: properties ?? [],
          ...(idProperty ? { idProperty } : {}),
        });
        const data = response.data as { results?: unknown[] };
        return data.results ?? [];
      });

      return result;
    }
  };

  properties = {
    list: async (objectType: string): Promise<ApiResponse> => this.base.get(`/crm/v3/properties/${objectType}`),
    create: async (objectType: string, body: object): Promise<ApiResponse> => {
      try {
        const result = await this.base.post(`/crm/v3/properties/${objectType}`, body);
        await safeLog({
          layer: "api",
          module: "C2",
          action: "property_create",
          objectType: "property",
          recordId: (result.data as { name?: string }).name || "unknown",
          description: `Created ${objectType} property`,
          after: result.data as object,
          status: "success"
        });
        return result;
      } catch (error) {
        await safeLog({
          layer: "api",
          module: "C2",
          action: "property_create",
          objectType: "property",
          recordId: "unknown",
          description: `Failed to create ${objectType} property`,
          status: "error",
          error: error instanceof Error ? error.message : "property create failed"
        });
        throw error;
      }
    },
    update: async (objectType: string, name: string, body: object): Promise<ApiResponse> => {
      try {
        const before = await this.base.get(`/crm/v3/properties/${objectType}/${name}`);
        const after = await this.base.patch(`/crm/v3/properties/${objectType}/${name}`, body);
        await safeLog({
          layer: "api",
          module: "C3",
          action: "update",
          objectType: "property",
          recordId: name,
          description: `Updated ${objectType} property ${name}`,
          before: before.data as object,
          after: after.data as object,
          status: "success"
        });
        return after;
      } catch (error) {
        await safeLog({
          layer: "api",
          module: "C3",
          action: "update",
          objectType: "property",
          recordId: name,
          description: `Failed to update ${objectType} property ${name}`,
          after: body,
          status: "error",
          error: error instanceof Error ? error.message : "property update failed"
        });
        throw error;
      }
    },
    delete: async (objectType: string, name: string): Promise<ApiResponse> => {
      try {
        const before = await this.base.get(`/crm/v3/properties/${objectType}/${name}`);
        const result = await this.base.delete(`/crm/v3/properties/${objectType}/${name}`);
        await safeLog({
          layer: "api",
          module: "C4",
          action: "delete",
          objectType: "property",
          recordId: name,
          description: `Deleted ${objectType} property ${name}`,
          before: before.data as object,
          status: "success"
        });
        return result;
      } catch (error) {
        await safeLog({
          layer: "api",
          module: "C4",
          action: "delete",
          objectType: "property",
          recordId: name,
          description: `Failed to delete ${objectType} property ${name}`,
          status: "error",
          error: error instanceof Error ? error.message : "property delete failed"
        });
        throw error;
      }
    }
  };

  associations = {
    list: async (type: string, id: string, toType: string): Promise<ApiResponse> =>
      this.base.get(`/crm/v4/objects/${type}/${id}/associations/${toType}`),
    create: async (type: string, id: string, toType: string, toId: string): Promise<ApiResponse> => {
      try {
        const result = await this.base.put(`/crm/v4/objects/${type}/${id}/associations/${toType}/${toId}`, [] as unknown as object);
        await safeLog({
          layer: "api",
          module: "A6",
          action: "associate",
          objectType: `${type}->${toType}`,
          recordId: `${id}:${toId}`,
          description: `Associated ${type} ${id} with ${toType} ${toId}`,
          after: result.data as object,
          status: "success"
        });
        return result;
      } catch (error) {
        await safeLog({
          layer: "api",
          module: "A6",
          action: "associate",
          objectType: `${type}->${toType}`,
          recordId: `${id}:${toId}`,
          description: `Failed association ${type} ${id} -> ${toType} ${toId}`,
          status: "error",
          error: error instanceof Error ? error.message : "association failed"
        });
        throw error;
      }
    },

    batchCreate: async (
      fromType: string,
      toType: string,
      pairs: Array<{ fromId: string; toId: string }>
    ): Promise<BatchResult> => {
      // v4 batch endpoint supports up to 2,000 pairs per call
      const result = await this.base.batchProcess(
        pairs,
        async (batch) => {
          const response = await this.base.post(
            `/crm/v4/associations/${fromType}/${toType}/batch/associate/default`,
            { inputs: batch.map((p) => ({ from: { id: p.fromId }, to: { id: p.toId } })) }
          );
          const data = response.data as { results?: unknown[] };
          return data.results ?? [];
        },
        100 // HubSpot supports 2,000 but keep batches reasonable for logging
      );

      await safeLog({
        layer: "api",
        module: "A6",
        action: "associate",
        objectType: `${fromType}->${toType}`,
        recordId: `batch-${Date.now()}`,
        description: `Batch associate ${pairs.length} ${fromType}->${toType} pairs`,
        after: { successes: result.successes.length, errors: result.errors.length },
        status: result.errors.length ? "error" : "success",
      });

      return result;
    }
  };

  pipelines = {
    list: async (objectType: string): Promise<ApiResponse> => this.base.get(`/crm/v3/pipelines/${objectType}`),
    create: async (objectType: string, body: object): Promise<ApiResponse> => {
      try {
        const result = await this.base.post(`/crm/v3/pipelines/${objectType}`, body);
        await safeLog({
          layer: "api",
          module: "E1",
          action: "create",
          objectType: "pipeline",
          recordId: (result.data as { id?: string }).id || "unknown",
          description: `Created pipeline for ${objectType}`,
          after: result.data as object,
          status: "success"
        });
        return result;
      } catch (error) {
        await safeLog({
          layer: "api",
          module: "E1",
          action: "create",
          objectType: "pipeline",
          recordId: "unknown",
          description: `Failed to create pipeline for ${objectType}`,
          status: "error",
          error: error instanceof Error ? error.message : "pipeline create failed"
        });
        throw error;
      }
    }
  };

  workflows = {
    list: async (): Promise<ApiResponse> => this.base.get("/automation/v4/flows"),
    create: async (body: object): Promise<ApiResponse> => {
      try {
        const payload = { ...(body as Record<string, unknown>), isEnabled: false };
        const result = await this.base.post("/automation/v4/flows", payload);
        await safeLog({
          layer: "api",
          module: "B2",
          action: "workflow_deploy",
          objectType: "workflow",
          recordId: (result.data as { flowId?: string; id?: string }).flowId || (result.data as { id?: string }).id || "unknown",
          description: "Created workflow with isEnabled=false",
          after: result.data as object,
          status: "success"
        });
        return result;
      } catch (error) {
        await safeLog({
          layer: "api",
          module: "B2",
          action: "workflow_deploy",
          objectType: "workflow",
          recordId: "unknown",
          description: "Failed workflow create",
          status: "error",
          error: error instanceof Error ? error.message : "workflow create failed"
        });
        throw error;
      }
    },
    update: async (flowId: string, body: object): Promise<ApiResponse> => {
      try {
        const before = await this.base.get(`/automation/v4/flows/${flowId}`);
        const payload = { ...(body as Record<string, unknown>), isEnabled: false };
        const after = await this.base.put(`/automation/v4/flows/${flowId}`, payload);
        await safeLog({
          layer: "api",
          module: "B4",
          action: "workflow_deploy",
          objectType: "workflow",
          recordId: flowId,
          description: "Updated workflow with isEnabled=false",
          before: before.data as object,
          after: after.data as object,
          status: "success"
        });
        return after;
      } catch (error) {
        await safeLog({
          layer: "api",
          module: "B4",
          action: "workflow_deploy",
          objectType: "workflow",
          recordId: flowId,
          description: "Failed workflow update",
          after: body,
          status: "error",
          error: error instanceof Error ? error.message : "workflow update failed"
        });
        throw error;
      }
    },
    delete: async (flowId: string): Promise<ApiResponse> => {
      try {
        const before = await this.base.get(`/automation/v4/flows/${flowId}`);
        const result = await this.base.delete(`/automation/v4/flows/${flowId}`);
        await safeLog({
          layer: "api",
          module: "B5",
          action: "delete",
          objectType: "workflow",
          recordId: flowId,
          description: "Deleted workflow",
          before: before.data as object,
          status: "success"
        });
        return result;
      } catch (error) {
        await safeLog({
          layer: "api",
          module: "B5",
          action: "delete",
          objectType: "workflow",
          recordId: flowId,
          description: "Failed workflow delete",
          status: "error",
          error: error instanceof Error ? error.message : "workflow delete failed"
        });
        throw error;
      }
    }
  };

  lists = {
    list: async (): Promise<ApiResponse> => this.base.get("/crm/v3/lists/"),
    create: async (body: object): Promise<ApiResponse> => {
      try {
        const result = await this.base.post("/crm/v3/lists/", body);
        await safeLog({
          layer: "api",
          module: "D1",
          action: "list_create",
          objectType: "list",
          recordId: (result.data as { listId?: string; id?: string }).listId || (result.data as { id?: string }).id || "unknown",
          description: "Created list",
          after: result.data as object,
          status: "success"
        });
        return result;
      } catch (error) {
        await safeLog({
          layer: "api",
          module: "D1",
          action: "list_create",
          objectType: "list",
          recordId: "unknown",
          description: "Failed list create",
          status: "error",
          error: error instanceof Error ? error.message : "list create failed"
        });
        throw error;
      }
    }
  };
}

export const hubSpotClient = new BaseHubSpotClient();
export const apiClient: ApiClient = new HubSpotApiClient();
