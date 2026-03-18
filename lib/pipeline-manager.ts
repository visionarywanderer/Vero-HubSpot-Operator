import { hubSpotClient } from "@/lib/api-client";
import { authManager } from "@/lib/auth-manager";
import { changeLogger } from "@/lib/change-logger";

export type PipelineObjectType = "deals" | "tickets";

export interface Stage {
  id?: string;
  stageId?: string;
  label: string;
  displayOrder?: number;
  metadata?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
  [key: string]: unknown;
}

export interface Pipeline {
  id?: string;
  pipelineId?: string;
  label: string;
  displayOrder?: number;
  stages: Stage[];
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
  [key: string]: unknown;
}

export interface PipelineSpec {
  label: string;
  displayOrder?: number;
  stages?: StageSpec[];
}

export interface StageSpec {
  label: string;
  displayOrder?: number;
  metadata?: Record<string, string>;
}

export interface PipelineAudit {
  pipeline: string;
  stageCount: number;
  issues: string[];
}

export interface PipelineManager {
  list(objectType: PipelineObjectType): Promise<Pipeline[]>;
  create(objectType: PipelineObjectType, spec: PipelineSpec): Promise<Pipeline>;
  get(objectType: PipelineObjectType, pipelineId: string): Promise<Pipeline>;
  update(objectType: PipelineObjectType, pipelineId: string, updates: Partial<PipelineSpec>): Promise<Pipeline>;
  delete(objectType: PipelineObjectType, pipelineId: string): Promise<void>;
  listStages(objectType: PipelineObjectType, pipelineId: string): Promise<Stage[]>;
  addStage(objectType: PipelineObjectType, pipelineId: string, stage: StageSpec): Promise<Stage>;
  updateStage(objectType: PipelineObjectType, pipelineId: string, stageId: string, updates: Partial<StageSpec>): Promise<Stage>;
  deleteStage(objectType: PipelineObjectType, pipelineId: string, stageId: string): Promise<void>;
  audit(objectType: PipelineObjectType): Promise<PipelineAudit[]>;
}

function pipelineIdOf(pipeline: Record<string, unknown>): string {
  return String(pipeline.id ?? pipeline.pipelineId ?? "unknown");
}

async function logPipelineChange(input: {
  action: "create" | "update" | "delete";
  recordId: string;
  description: string;
  status: "success" | "error";
  before?: object;
  after?: object;
  error?: string;
}): Promise<void> {
  try {
    await changeLogger.log({
      portalId: authManager.getActivePortal().id,
      layer: "api",
      module: "E1",
      action: input.action,
      objectType: "pipeline",
      recordId: input.recordId,
      description: input.description,
      before: input.before,
      after: input.after,
      status: input.status,
      error: input.error,
      initiatedBy: "VeroDigital"
    });
  } catch {
    // Never block on logging.
  }
}

class HubSpotPipelineManager implements PipelineManager {
  async list(objectType: PipelineObjectType): Promise<Pipeline[]> {
    const response = await hubSpotClient.get(`/crm/v3/pipelines/${objectType}`);
    const data = response.data as { results?: Pipeline[] };
    return data.results ?? [];
  }

  async create(objectType: PipelineObjectType, spec: PipelineSpec): Promise<Pipeline> {
    // Auto-prefix pipeline label with [VD] if not already present
    const prefixedSpec = {
      ...spec,
      label: spec.label.startsWith("[VD]") ? spec.label : `[VD] ${spec.label}`,
    };
    try {
      const response = await hubSpotClient.post(`/crm/v3/pipelines/${objectType}`, prefixedSpec);
      const pipeline = response.data as Pipeline;
      await logPipelineChange({
        action: "create",
        recordId: pipelineIdOf(pipeline as Record<string, unknown>),
        description: `Created ${objectType} pipeline ${pipeline.label}`,
        after: pipeline,
        status: "success"
      });
      return pipeline;
    } catch (error) {
      await logPipelineChange({
        action: "create",
        recordId: "unknown",
        description: `Failed to create ${objectType} pipeline ${spec.label}`,
        status: "error",
        error: error instanceof Error ? error.message : "pipeline create failed"
      });
      throw error;
    }
  }

  async get(objectType: PipelineObjectType, pipelineId: string): Promise<Pipeline> {
    const response = await hubSpotClient.get(`/crm/v3/pipelines/${objectType}/${pipelineId}`);
    return response.data as Pipeline;
  }

  async update(objectType: PipelineObjectType, pipelineId: string, updates: Partial<PipelineSpec>): Promise<Pipeline> {
    let before: Pipeline | null = null;
    try {
      before = await this.get(objectType, pipelineId);
    } catch {
      before = null;
    }

    try {
      const response = await hubSpotClient.patch(`/crm/v3/pipelines/${objectType}/${pipelineId}`, updates);
      const after = response.data as Pipeline;
      await logPipelineChange({
        action: "update",
        recordId: pipelineId,
        description: `Updated ${objectType} pipeline ${pipelineId}`,
        before: before ?? undefined,
        after,
        status: "success"
      });
      return after;
    } catch (error) {
      await logPipelineChange({
        action: "update",
        recordId: pipelineId,
        description: `Failed to update ${objectType} pipeline ${pipelineId}`,
        before: before ?? undefined,
        after: updates as object,
        status: "error",
        error: error instanceof Error ? error.message : "pipeline update failed"
      });
      throw error;
    }
  }

  async delete(objectType: PipelineObjectType, pipelineId: string): Promise<void> {
    let before: Pipeline | null = null;
    try {
      before = await this.get(objectType, pipelineId);
    } catch {
      before = null;
    }

    try {
      await hubSpotClient.delete(`/crm/v3/pipelines/${objectType}/${pipelineId}`);
      await logPipelineChange({
        action: "delete",
        recordId: pipelineId,
        description: `Deleted ${objectType} pipeline ${pipelineId}`,
        before: before ?? undefined,
        status: "success"
      });
    } catch (error) {
      await logPipelineChange({
        action: "delete",
        recordId: pipelineId,
        description: `Failed to delete ${objectType} pipeline ${pipelineId}`,
        before: before ?? undefined,
        status: "error",
        error: error instanceof Error ? error.message : "pipeline delete failed"
      });
      throw error;
    }
  }

  async listStages(objectType: PipelineObjectType, pipelineId: string): Promise<Stage[]> {
    const response = await hubSpotClient.get(`/crm/v3/pipelines/${objectType}/${pipelineId}/stages`);
    const data = response.data as { results?: Stage[] };
    return data.results ?? [];
  }

  async addStage(objectType: PipelineObjectType, pipelineId: string, stage: StageSpec): Promise<Stage> {
    const response = await hubSpotClient.post(`/crm/v3/pipelines/${objectType}/${pipelineId}/stages`, stage);
    const created = response.data as Stage;
    await logPipelineChange({
      action: "update",
      recordId: pipelineId,
      description: `Added stage ${stage.label} to ${objectType} pipeline ${pipelineId}`,
      after: created,
      status: "success"
    });
    return created;
  }

  async updateStage(
    objectType: PipelineObjectType,
    pipelineId: string,
    stageId: string,
    updates: Partial<StageSpec>
  ): Promise<Stage> {
    const response = await hubSpotClient.patch(
      `/crm/v3/pipelines/${objectType}/${pipelineId}/stages/${stageId}`,
      updates
    );
    const stage = response.data as Stage;
    await logPipelineChange({
      action: "update",
      recordId: `${pipelineId}:${stageId}`,
      description: `Updated stage ${stageId} in ${objectType} pipeline ${pipelineId}`,
      after: stage,
      status: "success"
    });
    return stage;
  }

  async deleteStage(objectType: PipelineObjectType, pipelineId: string, stageId: string): Promise<void> {
    try {
      await hubSpotClient.delete(`/crm/v3/pipelines/${objectType}/${pipelineId}/stages/${stageId}`);
      await logPipelineChange({
        action: "delete",
        recordId: `${pipelineId}:${stageId}`,
        description: `Deleted stage ${stageId} from ${objectType} pipeline ${pipelineId}`,
        status: "success"
      });
    } catch (error) {
      await logPipelineChange({
        action: "delete",
        recordId: `${pipelineId}:${stageId}`,
        description: `Failed to delete stage ${stageId} from ${objectType} pipeline ${pipelineId}`,
        status: "error",
        error: error instanceof Error ? error.message : "stage delete failed"
      });
      throw error;
    }
  }

  async audit(objectType: PipelineObjectType): Promise<PipelineAudit[]> {
    const pipelines = await this.list(objectType);

    return pipelines.map((pipeline) => {
      const issues: string[] = [];
      const stageCount = Array.isArray(pipeline.stages) ? pipeline.stages.length : 0;

      if (stageCount > 8) issues.push("Too many stages (>8) — simplify");
      if (stageCount < 3) issues.push("Too few stages (<3) — might need more granularity");

      const hasWon = (pipeline.stages || []).some((stage) => stage.metadata?.closedWon === "true");
      const hasLost = (pipeline.stages || []).some(
        (stage) => stage.metadata?.closedWon === "false" && stage.metadata?.isClosed === "true"
      );

      if (!hasWon) issues.push("Missing Closed Won stage");
      if (!hasLost) issues.push("Missing Closed Lost stage");

      return {
        pipeline: pipeline.label,
        stageCount,
        issues
      };
    });
  }
}

export const pipelineManager: PipelineManager = new HubSpotPipelineManager();
