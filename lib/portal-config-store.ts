import db from "@/lib/db";
import { hubSpotClient } from "@/lib/api-client";

export interface PortalConfig {
  portalId: string;
  hubId: string;
  name: string;
  environment: "production" | "sandbox";
  mappings: {
    lifecycleStages: Record<string, string>;
    dealStages: {
      pipeline: string;
      stages: Record<string, string>;
    };
  };
  customProperties: Record<string, string>;
  owners: Record<string, string>;
  conventions: {
    taskPrefix: string;
    notePrefix: string;
    workflowPrefix: string;
  };
  forms: Record<string, string>;
  emailTemplates: Record<string, string>;
  lists: Record<string, string>;
  safety: {
    maxBulkRecords: number;
    requireDryRun: boolean;
    requireConfirmation: boolean;
    allowDeletes: boolean;
  };
}

export interface PortalConfigSummary {
  portalId: string;
  hubId: string;
  name: string;
  environment: "production" | "sandbox";
}

export type PartialPortalConfig = Partial<PortalConfig>;

export interface PortalConfigStore {
  load(portalId: string): Promise<PortalConfig>;
  save(portalId: string, config: PortalConfig): Promise<void>;
  update(portalId: string, keyPath: string, value: unknown): Promise<void>;
  list(): Promise<PortalConfigSummary[]>;
  discover(portalId: string): Promise<PartialPortalConfig>;
}

function defaultConfig(portalId: string): PortalConfig {
  return {
    portalId,
    hubId: "",
    name: portalId,
    environment: "production",
    mappings: {
      lifecycleStages: {},
      dealStages: { pipeline: "default", stages: {} }
    },
    customProperties: {},
    owners: {},
    conventions: {
      taskPrefix: "[Vero Audit]",
      notePrefix: "[Vero] ",
      workflowPrefix: "[Auto] "
    },
    forms: {},
    emailTemplates: {},
    lists: {},
    safety: {
      maxBulkRecords: 5000,
      requireDryRun: true,
      requireConfirmation: true,
      allowDeletes: false
    }
  };
}

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Safely set a nested value in a target object using a dot-separated key path.
 * Uses a build-then-merge approach to avoid prototype-polluting dynamic assignments.
 */
function deepSet(target: Record<string, unknown>, keyPath: string, value: unknown): void {
  const keys = keyPath.split(".").filter(Boolean);
  if (!keys.length) return;

  // Reject any key that could pollute prototypes
  for (const k of keys) {
    if (FORBIDDEN_KEYS.has(k)) return;
  }

  // Build the nested structure bottom-up (no dynamic assignments on live objects)
  let nested: unknown = value;
  for (let i = keys.length - 1; i > 0; i--) {
    const wrapper: Record<string, unknown> = Object.create(null);
    Object.defineProperty(wrapper, keys[i], { value: nested, writable: true, enumerable: true, configurable: true });
    nested = wrapper;
  }

  // Merge into target at the top-level key using Object.defineProperty (safe from prototype pollution)
  const topKey = keys[0];
  if (keys.length === 1) {
    Object.defineProperty(target, topKey, { value, writable: true, enumerable: true, configurable: true });
  } else {
    // Deep merge: if the top-level key already exists as an object, merge into it
    const existing = target[topKey];
    if (typeof existing === "object" && existing !== null) {
      const merged = JSON.parse(JSON.stringify(existing));
      const incoming = JSON.parse(JSON.stringify(nested));
      Object.assign(merged, incoming);
      Object.defineProperty(target, topKey, { value: merged, writable: true, enumerable: true, configurable: true });
    } else {
      Object.defineProperty(target, topKey, { value: nested, writable: true, enumerable: true, configurable: true });
    }
  }
}

class SqlitePortalConfigStore implements PortalConfigStore {
  async load(portalId: string): Promise<PortalConfig> {
    const row = db.prepare("SELECT config FROM portal_config WHERE portal_id = ?").get(portalId) as { config: string } | undefined;
    if (!row) return defaultConfig(portalId);

    try {
      return JSON.parse(row.config) as PortalConfig;
    } catch {
      return defaultConfig(portalId);
    }
  }

  async save(portalId: string, config: PortalConfig): Promise<void> {
    db.prepare(
      "INSERT INTO portal_config(portal_id, config) VALUES(?, ?) ON CONFLICT(portal_id) DO UPDATE SET config = excluded.config"
    ).run(portalId, JSON.stringify(config));
  }

  async update(portalId: string, keyPath: string, value: unknown): Promise<void> {
    const current = await this.load(portalId);
    deepSet(current as unknown as Record<string, unknown>, keyPath, value);
    await this.save(portalId, current);
  }

  async list(): Promise<PortalConfigSummary[]> {
    const rows = db.prepare("SELECT portal_id, config FROM portal_config ORDER BY portal_id ASC").all() as Array<{ portal_id: string; config: string }>;
    return rows.map((row) => {
      let parsed: PortalConfig;
      try {
        parsed = JSON.parse(row.config) as PortalConfig;
      } catch {
        parsed = defaultConfig(row.portal_id);
      }
      return {
        portalId: parsed.portalId,
        hubId: parsed.hubId,
        name: parsed.name,
        environment: parsed.environment
      };
    });
  }

  async discover(portalId: string): Promise<PartialPortalConfig> {
    const safeGet = async (path: string) => {
      try {
        return await hubSpotClient.get(path);
      } catch {
        return { status: 0, data: { results: [] } };
      }
    };

    const [contactPropsResp, dealPipelinesResp, ownersResp, listsResp] = await Promise.all([
      safeGet("/crm/v3/properties/contacts"),
      safeGet("/crm/v3/pipelines/deals"),
      safeGet("/crm/v3/owners"),
      safeGet("/crm/v3/lists/")
    ]);

    const contactProps = (contactPropsResp.data as { results?: Array<{ name: string }> }).results ?? [];
    const dealPipelines =
      (dealPipelinesResp.data as { results?: Array<{ id?: string; stages?: Array<{ id?: string; label?: string }> }> }).results ?? [];
    const owners = (ownersResp.data as { results?: Array<{ id?: string; email?: string; firstName?: string; lastName?: string }> }).results ?? [];
    const lists = (listsResp.data as { results?: Array<{ id?: string; listId?: string; name?: string }> }).results ?? [];

    const customProperties: Record<string, string> = {};
    for (const prop of contactProps) {
      if (prop.name?.includes("score")) customProperties.leadScore = prop.name;
      if (prop.name?.includes("segment")) customProperties.leadSegment = prop.name;
      if (prop.name === "industry") customProperties.industry = prop.name;
      if (prop.name === "annualrevenue") customProperties.revenue = prop.name;
    }

    const defaultPipeline = dealPipelines[0];
    const mappedStages: Record<string, string> = {};
    for (const stage of defaultPipeline?.stages ?? []) {
      const label = (stage.label || "").toLowerCase();
      if (label.includes("discovery")) mappedStages.discovery = String(stage.id || "");
      if (label.includes("proposal")) mappedStages.proposal = String(stage.id || "");
      if (label.includes("negotiation")) mappedStages.negotiation = String(stage.id || "");
      if (label.includes("won")) mappedStages.closed_won = String(stage.id || "");
      if (label.includes("lost")) mappedStages.closed_lost = String(stage.id || "");
    }

    const ownerMap: Record<string, string> = {};
    for (const owner of owners) {
      const key = owner.email || `${owner.firstName || ""}_${owner.lastName || ""}`.trim();
      if (key && owner.id) ownerMap[key] = owner.id;
    }

    const listMap: Record<string, string> = {};
    for (const list of lists) {
      if (list.name) listMap[list.name] = String(list.id ?? list.listId ?? "");
    }

    return {
      portalId,
      customProperties,
      mappings: {
        lifecycleStages: {
          new: "subscriber",
          qualified: "marketingqualifiedlead",
          sales_ready: "salesqualifiedlead",
          customer: "customer",
          churned: "other"
        },
        dealStages: {
          pipeline: String(defaultPipeline?.id ?? "default"),
          stages: mappedStages
        }
      },
      owners: ownerMap,
      lists: listMap
    };
  }
}

export const portalConfigStore: PortalConfigStore = new SqlitePortalConfigStore();
