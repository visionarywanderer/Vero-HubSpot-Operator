import { apiClient, hubSpotClient } from "@/lib/api-client";
import { getCachedProperties, setCachedProperties, invalidatePropertyCache } from "@/lib/property-cache";
import { authManager } from "@/lib/auth-manager";

export interface Property {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  groupName?: string;
  description?: string;
  displayOrder?: number;
  hasUniqueValue?: boolean;
  hidden?: boolean;
  formField?: boolean;
  calculated?: boolean;
  externalOptions?: boolean;
  hubspotDefined?: boolean;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
  options?: Array<{ label: string; value: string; displayOrder?: number; hidden?: boolean }>;
  modificationMetadata?: {
    readOnlyDefinition?: boolean;
    readOnlyOptions?: boolean;
    readOnlyValue?: boolean;
    archivable?: boolean;
  };
  [key: string]: unknown;
}

export interface PropertySpec {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  groupName?: string;
  description?: string;
  displayOrder?: number;
  hasUniqueValue?: boolean;
  hidden?: boolean;
  formField?: boolean;
  options?: Array<{ label: string; value: string; displayOrder?: number }>;
  [key: string]: unknown;
}

export interface PropertyAudit {
  name: string;
  label: string;
  type: string;
  isCustom: boolean;
  fillRate: number;
  recommendation: "DELETE_CANDIDATE" | "REVIEW" | "OK";
}

export interface PropertyGroup {
  name: string;
  label: string;
  displayOrder?: number;
  archived?: boolean;
}

export interface PropertyManager {
  list(objectType: string): Promise<Property[]>;
  create(objectType: string, spec: PropertySpec): Promise<Property>;
  update(objectType: string, name: string, updates: Partial<PropertySpec>): Promise<Property>;
  delete(objectType: string, name: string): Promise<void>;
  listGroups(objectType: string): Promise<PropertyGroup[]>;
  createGroup(objectType: string, spec: { name: string; label: string; displayOrder?: number }): Promise<PropertyGroup>;
  audit(objectType: string): Promise<PropertyAudit[]>;
}

function recommendationFromFillRate(fillRate: number): "DELETE_CANDIDATE" | "REVIEW" | "OK" {
  if (fillRate < 0.05) {
    return "DELETE_CANDIDATE";
  }
  if (fillRate < 0.2) {
    return "REVIEW";
  }
  return "OK";
}

async function sampleRecords(objectType: string, propertyNames: string[], limit = 200): Promise<Array<Record<string, unknown>>> {
  const records: Array<Record<string, unknown>> = [];
  let after: string | undefined;

  while (records.length < limit) {
    const response = await hubSpotClient.get(`/crm/v3/objects/${objectType}`, {
      limit: Math.min(100, limit - records.length),
      ...(after ? { after } : {}),
      ...(propertyNames.length ? { properties: propertyNames.join(",") } : {})
    });

    const data = response.data as { results?: Array<Record<string, unknown>>; paging?: { next?: { after?: string } } };
    records.push(...(data.results ?? []));

    after = data.paging?.next?.after;
    if (!after) {
      break;
    }
  }

  return records;
}

class HubSpotPropertyManager implements PropertyManager {
  async list(objectType: string): Promise<Property[]> {
    // Check session-scoped cache first (5-min TTL)
    try {
      const portalId = authManager.getActivePortal().id;
      const cached = getCachedProperties(portalId, objectType);
      if (cached) return cached;

      const response = await apiClient.properties.list(objectType);
      const data = response.data as { results?: Property[] };
      const results = data.results ?? [];
      setCachedProperties(portalId, objectType, results);
      return results;
    } catch {
      // Fallback without caching if portal context not available
      const response = await apiClient.properties.list(objectType);
      const data = response.data as { results?: Property[] };
      return data.results ?? [];
    }
  }

  async create(objectType: string, spec: PropertySpec): Promise<Property> {
    const response = await apiClient.properties.create(objectType, spec);
    // Invalidate cache so subsequent list() calls include the new property
    try { invalidatePropertyCache(authManager.getActivePortal().id, objectType); } catch { /* ok */ }
    return response.data as Property;
  }

  async update(objectType: string, name: string, updates: Partial<PropertySpec>): Promise<Property> {
    const response = await apiClient.properties.update(objectType, name, updates);
    try { invalidatePropertyCache(authManager.getActivePortal().id, objectType); } catch { /* ok */ }
    return response.data as Property;
  }

  async delete(objectType: string, name: string): Promise<void> {
    await apiClient.properties.delete(objectType, name);
    try { invalidatePropertyCache(authManager.getActivePortal().id, objectType); } catch { /* ok */ }
  }

  async listGroups(objectType: string): Promise<PropertyGroup[]> {
    const response = await hubSpotClient.get(`/crm/v3/properties/${objectType}/groups`);
    const data = response.data as { results?: PropertyGroup[] };
    return data.results ?? [];
  }

  async createGroup(objectType: string, spec: { name: string; label: string; displayOrder?: number }): Promise<PropertyGroup> {
    const response = await hubSpotClient.post(`/crm/v3/properties/${objectType}/groups`, spec);
    return response.data as PropertyGroup;
  }

  async audit(objectType: string): Promise<PropertyAudit[]> {
    const properties = await this.list(objectType);
    const propertyNames = properties.map((property) => property.name).filter(Boolean);
    const records = await sampleRecords(objectType, propertyNames, 200);

    return properties.map((property) => {
      const populatedCount = records.filter((record) => {
        const props = (record.properties as Record<string, unknown> | undefined) ?? {};
        const value = props[property.name];
        return value !== null && value !== undefined && String(value).trim() !== "";
      }).length;

      const fillRate = records.length ? populatedCount / records.length : 0;

      return {
        name: property.name,
        label: property.label,
        type: property.type,
        isCustom: !property.hubspotDefined,
        fillRate,
        recommendation: recommendationFromFillRate(fillRate)
      };
    });
  }
}

export const propertyManager: PropertyManager = new HubSpotPropertyManager();
