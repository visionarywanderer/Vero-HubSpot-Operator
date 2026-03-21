import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { propertyManager } from "@/lib/property-manager";
import { pipelineManager } from "@/lib/pipeline-manager";
import { listManager } from "@/lib/list-manager";
import { workflowEngine } from "@/lib/workflow-engine";
import { templateStore } from "@/lib/template-store";
import type {
  TemplateDefinition,
  TemplateResources,
  PropertyGroupSpec,
  PropertyResourceSpec,
  PipelineResourceSpec,
  ListResourceSpec,
  WorkflowResourceSpec,
} from "@/lib/template-types";

const DEFAULT_OBJECT_TYPES = ["contacts", "companies", "deals", "tickets"];

/** POST /api/templates/export — Export portal configuration as a reusable template */
export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    name?: string;
    objectTypes?: string[];
    includeWorkflows?: boolean;
    includeLists?: boolean;
    portalId?: string;
  };

  if (!body.name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
  if (!body.portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

  try {
    const template = await authManager.withPortal(body.portalId, async () => {
      const objectTypes = body.objectTypes || DEFAULT_OBJECT_TYPES;
      const includeWorkflows = body.includeWorkflows !== false;
      const includeLists = body.includeLists !== false;

      const resources: TemplateResources = {};

      // Export property groups and custom properties for each object type
      const propertyGroups: PropertyGroupSpec[] = [];
      const properties: PropertyResourceSpec[] = [];

      for (const objectType of objectTypes) {
        // Groups
        const groups = await propertyManager.listGroups(objectType);
        for (const g of groups) {
          if (!g.archived) {
            propertyGroups.push({
              name: g.name,
              label: g.label,
              displayOrder: g.displayOrder,
              objectType,
            });
          }
        }

        // Custom properties only (skip HubSpot-defined)
        const allProps = await propertyManager.list(objectType);
        const customProps = allProps.filter((p) => !p.hubspotDefined && !p.archived);
        for (const p of customProps) {
          properties.push({
            name: p.name,
            label: p.label,
            type: p.type,
            fieldType: p.fieldType,
            groupName: p.groupName,
            objectType,
            description: p.description,
            options: p.options?.map((o) => ({
              label: o.label,
              value: o.value,
              displayOrder: o.displayOrder,
            })),
          });
        }
      }

      if (propertyGroups.length > 0) resources.propertyGroups = propertyGroups;
      if (properties.length > 0) resources.properties = properties;

      // Export pipelines for deals and tickets
      const pipelines: PipelineResourceSpec[] = [];
      for (const ot of (["deals", "tickets"] as const).filter((t) => objectTypes.includes(t))) {
        const pipelineList = await pipelineManager.list(ot);
        for (const pl of pipelineList) {
          const stages = Array.isArray(pl.stages)
            ? pl.stages.map((s: Record<string, unknown>, i: number) => ({
                label: String(s.label || ""),
                displayOrder: Number(s.displayOrder ?? i),
                metadata: s.metadata as Record<string, string> | undefined,
              }))
            : [];
          pipelines.push({
            label: String(pl.label || ""),
            objectType: ot,
            displayOrder: pl.displayOrder as number | undefined,
            stages,
          });
        }
      }
      if (pipelines.length > 0) resources.pipelines = pipelines;

      // Export lists
      if (includeLists) {
        const allLists = await listManager.list();
        const listSpecs: ListResourceSpec[] = allLists.map((l) => ({
          name: String(l.name || ""),
          objectTypeId: String(l.objectTypeId || "0-1"),
          processingType: (l.processingType === "MANUAL" ? "MANUAL" : "DYNAMIC") as "DYNAMIC" | "MANUAL",
        }));
        if (listSpecs.length > 0) resources.lists = listSpecs;
      }

      // Export workflows
      if (includeWorkflows) {
        const allWorkflows = await workflowEngine.list();
        const workflowSpecs: WorkflowResourceSpec[] = [];

        for (const wSummary of allWorkflows) {
          const flowId = String(wSummary.flowId || wSummary.id || "");
          if (!flowId) continue;

          try {
            const fullSpec = await workflowEngine.get(flowId);
            workflowSpecs.push({
              name: String(fullSpec.name || wSummary.name || ""),
              type: (fullSpec.type === "CONTACT_FLOW" ? "CONTACT_FLOW" : "PLATFORM_FLOW") as "CONTACT_FLOW" | "PLATFORM_FLOW",
              objectTypeId: String(fullSpec.objectTypeId || "0-1"),
              startActionId: String(fullSpec.startActionId || "1"),
              nextAvailableActionId: Number(fullSpec.nextAvailableActionId || 1),
              enrollmentCriteria: (fullSpec.enrollmentCriteria || {}) as Record<string, unknown>,
              actions: (Array.isArray(fullSpec.actions) ? fullSpec.actions : []) as WorkflowResourceSpec["actions"],
            });
          } catch {
            // Skip workflows that can't be fetched (permission issues)
          }
        }

        if (workflowSpecs.length > 0) resources.workflows = workflowSpecs;
      }

      // Build template definition
      const templateDef: TemplateDefinition = {
        id: `export-${Date.now()}`,
        name: body.name!,
        version: "1.0.0",
        description: `Exported from portal on ${new Date().toISOString()}`,
        author: "VeroDigital",
        resources,
      };

      // Save to template store
      await templateStore.saveTemplate(templateDef);

      return templateDef;
    });

    return NextResponse.json({ ok: true, template });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}
