import { hubSpotClient } from "@/lib/api-client";
import { authManager } from "@/lib/auth-manager";
import { changeLogger } from "@/lib/change-logger";

export interface ListSummary {
  listId?: string;
  id?: string;
  name?: string;
  processingType?: string;
  objectTypeId?: string;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface HubSpotList extends ListSummary {
  filterBranch?: Record<string, unknown>;
}

export interface ListSpec {
  name: string;
  objectTypeId: string;
  processingType: "DYNAMIC" | "MANUAL";
  filterBranch?: Record<string, unknown>;
}

export interface ListAudit {
  listId: string;
  name: string;
  processingType: string;
  size: number;
  recommendation: "EMPTY_DELETE_CANDIDATE" | "STALE_REVIEW" | "OK";
}

export interface ListManager {
  list(): Promise<ListSummary[]>;
  create(spec: ListSpec): Promise<HubSpotList>;
  get(listId: string): Promise<HubSpotList>;
  update(listId: string, spec: Partial<ListSpec>): Promise<HubSpotList>;
  delete(listId: string): Promise<void>;
  addMembers(listId: string, recordIds: string[]): Promise<void>;
  removeMembers(listId: string, recordIds: string[]): Promise<void>;
  audit(): Promise<ListAudit[]>;
}

function getListId(list: Record<string, unknown>): string {
  return String(list.listId ?? list.id ?? "");
}

async function logListChange(input: {
  action: "list_create" | "delete" | "update";
  listId: string;
  description: string;
  after?: object;
  before?: object;
  status: "success" | "error";
  error?: string;
}): Promise<void> {
  try {
    await changeLogger.log({
      portalId: authManager.getActivePortal().id,
      layer: "api",
      module: "D1",
      action: input.action,
      objectType: "list",
      recordId: input.listId,
      description: input.description,
      before: input.before,
      after: input.after,
      status: input.status,
      error: input.error,
      initiatedBy: "VeroDigital"
    });
  } catch {
    // Do not fail list operations when logger fails.
  }
}

class HubSpotListManager implements ListManager {
  async list(): Promise<ListSummary[]> {
    const response = await hubSpotClient.get("/crm/v3/lists/");
    const data = response.data as { results?: ListSummary[] };
    return data.results ?? [];
  }

  async create(spec: ListSpec): Promise<HubSpotList> {
    try {
      const payload: Record<string, unknown> = {
        name: spec.name,
        objectTypeId: spec.objectTypeId,
        processingType: spec.processingType
      };

      if (spec.processingType === "DYNAMIC" && spec.filterBranch) {
        payload.filterBranch = spec.filterBranch;
      }

      const response = await hubSpotClient.post("/crm/v3/lists/", payload);
      const list = response.data as HubSpotList;
      const listId = getListId(list as Record<string, unknown>) || "unknown";

      await logListChange({
        action: "list_create",
        listId,
        description: `Created ${spec.processingType.toLowerCase()} list \"${spec.name}\"`,
        after: list,
        status: "success"
      });

      return list;
    } catch (error) {
      await logListChange({
        action: "list_create",
        listId: "unknown",
        description: `Failed to create list \"${spec.name}\"`,
        status: "error",
        error: error instanceof Error ? error.message : "list create failed"
      });
      throw error;
    }
  }

  async get(listId: string): Promise<HubSpotList> {
    const safeId = encodeURIComponent(listId);
    const response = await hubSpotClient.get(`/crm/v3/lists/${safeId}`);
    return response.data as HubSpotList;
  }

  async update(listId: string, spec: Partial<ListSpec>): Promise<HubSpotList> {
    let before: HubSpotList | null = null;
    try {
      before = await this.get(listId);
    } catch {
      before = null;
    }

    try {
      const response = await hubSpotClient.put(`/crm/v3/lists/${encodeURIComponent(listId)}`, spec);
      const updated = response.data as HubSpotList;

      await logListChange({
        action: "update",
        listId,
        description: `Updated list ${listId}`,
        before: before ?? undefined,
        after: updated,
        status: "success"
      });

      return updated;
    } catch (error) {
      await logListChange({
        action: "update",
        listId,
        description: `Failed to update list ${listId}`,
        before: before ?? undefined,
        after: spec as object,
        status: "error",
        error: error instanceof Error ? error.message : "list update failed"
      });
      throw error;
    }
  }

  async delete(listId: string): Promise<void> {
    let before: HubSpotList | null = null;
    try {
      before = await this.get(listId);
    } catch {
      before = null;
    }

    try {
      await hubSpotClient.delete(`/crm/v3/lists/${encodeURIComponent(listId)}`);
      await logListChange({
        action: "delete",
        listId,
        description: `Deleted list ${listId}`,
        before: before ?? undefined,
        status: "success"
      });
    } catch (error) {
      await logListChange({
        action: "delete",
        listId,
        description: `Failed to delete list ${listId}`,
        before: before ?? undefined,
        status: "error",
        error: error instanceof Error ? error.message : "list delete failed"
      });
      throw error;
    }
  }

  async addMembers(listId: string, recordIds: string[]): Promise<void> {
    try {
      await hubSpotClient.put(`/crm/v3/lists/${encodeURIComponent(listId)}/memberships/add`, {
        recordIdsToAdd: recordIds.map((id) => Number(id))
      });

      await logListChange({
        action: "update",
        listId,
        description: `Added ${recordIds.length} record(s) to list ${listId}`,
        after: { recordIdsToAdd: recordIds },
        status: "success"
      });
    } catch (error) {
      await logListChange({
        action: "update",
        listId,
        description: `Failed to add members to list ${listId}`,
        after: { recordIdsToAdd: recordIds },
        status: "error",
        error: error instanceof Error ? error.message : "list add members failed"
      });
      throw error;
    }
  }

  async removeMembers(listId: string, recordIds: string[]): Promise<void> {
    try {
      await hubSpotClient.put(`/crm/v3/lists/${encodeURIComponent(listId)}/memberships/remove`, {
        recordIdsToRemove: recordIds.map((id) => Number(id))
      });

      await logListChange({
        action: "update",
        listId,
        description: `Removed ${recordIds.length} record(s) from list ${listId}`,
        after: { recordIdsToRemove: recordIds },
        status: "success"
      });
    } catch (error) {
      await logListChange({
        action: "update",
        listId,
        description: `Failed to remove members from list ${listId}`,
        after: { recordIdsToRemove: recordIds },
        status: "error",
        error: error instanceof Error ? error.message : "list remove members failed"
      });
      throw error;
    }
  }

  async audit(): Promise<ListAudit[]> {
    const lists = await this.list();
    const now = Date.now();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

    return lists.map((list) => {
      const listId = String(list.listId ?? list.id ?? "unknown");
      const size = Number(list.size ?? 0);
      const updatedAt = list.updatedAt ? Date.parse(String(list.updatedAt)) : NaN;
      const stale = Number.isFinite(updatedAt) ? now - updatedAt > ninetyDaysMs : false;

      let recommendation: ListAudit["recommendation"] = "OK";
      if (size === 0) {
        recommendation = "EMPTY_DELETE_CANDIDATE";
      } else if (stale) {
        recommendation = "STALE_REVIEW";
      }

      return {
        listId,
        name: String(list.name ?? "Unnamed List"),
        processingType: String(list.processingType ?? "UNKNOWN"),
        size,
        recommendation
      };
    });
  }
}

export const listManager: ListManager = new HubSpotListManager();
