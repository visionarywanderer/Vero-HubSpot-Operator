/**
 * Template type definitions for the HubSpot Configuration Execution Engine.
 * Templates describe CRM configurations that can be validated, resolved, and installed.
 */

// --- Resource Specs ---

export interface PropertyGroupSpec {
  name: string;
  label: string;
  displayOrder?: number;
  objectType: string;
}

export interface PropertyResourceSpec {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  groupName?: string;
  objectType: string;
  description?: string;
  options?: Array<{ label: string; value: string; displayOrder?: number }>;
}

export interface PipelineStageSpec {
  label: string;
  displayOrder: number;
  metadata?: Record<string, string>;
}

export interface PipelineResourceSpec {
  label: string;
  objectType: "deals" | "tickets";
  displayOrder?: number;
  stages: PipelineStageSpec[];
}

export interface WorkflowActionSpec {
  actionId: string;
  actionTypeId: string;
  connection?: { nextActionId?: string };
  [key: string]: unknown;
}

export interface WorkflowResourceSpec {
  name: string;
  type: "CONTACT_FLOW" | "PLATFORM_FLOW";
  objectTypeId: string;
  startActionId: string;
  nextAvailableActionId: number;
  enrollmentCriteria: Record<string, unknown>;
  actions: WorkflowActionSpec[];
}

export interface ListResourceSpec {
  name: string;
  objectTypeId: string;
  processingType: "DYNAMIC" | "MANUAL";
  filterBranch?: Record<string, unknown>;
}

export interface CustomObjectSpec {
  name: string;
  labels: { singular: string; plural: string };
  primaryDisplayProperty: string;
  properties?: PropertyResourceSpec[];
}

export interface AssociationSpec {
  fromObjectType: string;
  toObjectType: string;
  category?: "HUBSPOT_DEFINED" | "USER_DEFINED" | "INTEGRATOR_DEFINED";
  label?: string;
}

// --- Template Definition ---

export interface TemplateResources {
  propertyGroups?: PropertyGroupSpec[];
  properties?: PropertyResourceSpec[];
  pipelines?: PipelineResourceSpec[];
  workflows?: WorkflowResourceSpec[];
  lists?: ListResourceSpec[];
  customObjects?: CustomObjectSpec[];
  associations?: AssociationSpec[];
}

export interface TemplateDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  tags?: string[];
  resources: TemplateResources;
}

// --- Installation Packs ---

export interface PackDefinition {
  id: string;
  name: string;
  description: string;
  templateIds: string[];
}

// --- Execution Types ---

export type ResourceType =
  | "propertyGroup"
  | "property"
  | "pipeline"
  | "workflow"
  | "list"
  | "customObject"
  | "association";

export interface ResolvedResource {
  type: ResourceType;
  spec: Record<string, unknown>;
  dependsOn: string[];
  key: string;
}

export interface ValidationError {
  resource: string;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ResourceExecutionResult {
  key: string;
  type: ResourceType;
  status: "success" | "error" | "skipped";
  hubspotId?: string;
  error?: string;
}

export interface ExecutionReport {
  templateId?: string;
  portalId: string;
  status: "success" | "partial" | "failed";
  results: ResourceExecutionResult[];
  startedAt: string;
  completedAt: string;
}
