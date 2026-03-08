import { apiClient, hubSpotClient } from "@/lib/api-client";

export interface Property {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  hubspotDefined?: boolean;
  [key: string]: unknown;
}

export interface PropertySpec {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  groupName?: string;
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

export interface PropertyManager {
  list(objectType: string): Promise<Property[]>;
  create(objectType: string, spec: PropertySpec): Promise<Property>;
  update(objectType: string, name: string, updates: Partial<PropertySpec>): Promise<Property>;
  delete(objectType: string, name: string): Promise<void>;
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
    const response = await apiClient.properties.list(objectType);
    const data = response.data as { results?: Property[] };
    return data.results ?? [];
  }

  async create(objectType: string, spec: PropertySpec): Promise<Property> {
    const response = await apiClient.properties.create(objectType, spec);
    return response.data as Property;
  }

  async update(objectType: string, name: string, updates: Partial<PropertySpec>): Promise<Property> {
    const response = await apiClient.properties.update(objectType, name, updates);
    return response.data as Property;
  }

  async delete(objectType: string, name: string): Promise<void> {
    await apiClient.properties.delete(objectType, name);
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
