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

/** A workflow action that was stripped during partial-install and must be added manually. */
export interface StrippedAction {
  /** actionId from the workflow spec */
  actionId: string;
  /** HubSpot actionTypeId (e.g. "0-11") */
  actionTypeId: string;
  /** Human-readable label for the action type */
  label: string;
  /** Why this action was stripped (raw HubSpot error or known reason) */
  reason: string;
  /** Exact steps the user must follow to add this action manually in HubSpot UI */
  manualStep: string;
}

/** A manual step the user must complete after automated installation. */
export interface ManualStep {
  /** Human-readable instruction */
  step: string;
  /** required = breaks the workflow logic if skipped; optional = enhancement only */
  priority: "required" | "optional";
}

export interface ResourceExecutionResult {
  key: string;
  type: ResourceType;
  status: "success" | "partial" | "error" | "skipped";
  hubspotId?: string;
  error?: string;
  /** Actions that were stripped during partial-install (workflow resources only) */
  strippedActions?: StrippedAction[];
  /** Manual steps needed to complete this resource (workflow resources only) */
  manualSteps?: ManualStep[];
}

export interface ExecutionReport {
  templateId?: string;
  portalId: string;
  status: "success" | "partial" | "failed";
  results: ResourceExecutionResult[];
  startedAt: string;
  completedAt: string;
  /** Aggregate manual steps across all resources — shown to the user after install */
  manualSteps?: ManualStep[];
}
