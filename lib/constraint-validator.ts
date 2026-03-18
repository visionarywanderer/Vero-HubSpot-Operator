/**
 * Constraint Validator — validates resource specs against the HubSpot constraint registry.
 */

import propertyConstraints from "@/hubspot_constraints/property_types.json";
import pipelineConstraints from "@/hubspot_constraints/pipeline_schema.json";
import workflowConstraints from "@/hubspot_constraints/workflow_actions.json";
import customObjectConstraints from "@/hubspot_constraints/custom_objects_schema.json";
import listConstraints from "@/hubspot_constraints/list_filters.json";
import associationConstraints from "@/hubspot_constraints/associations_schema.json";

import type {
  PropertyResourceSpec,
  PipelineResourceSpec,
  WorkflowResourceSpec,
  CustomObjectSpec,
  ListResourceSpec,
  AssociationSpec,
  PropertyGroupSpec,
  TemplateDefinition,
  ValidationError,
  ValidationResult,
} from "@/lib/template-types";

function err(resource: string, field: string, message: string): ValidationError {
  return { resource, field, message };
}

// --- Property Validation ---

export function validatePropertyGroup(spec: PropertyGroupSpec): ValidationError[] {
  const errors: ValidationError[] = [];
  const key = `propertyGroup:${spec.name}`;

  if (!spec.name) errors.push(err(key, "name", "Property group name is required"));
  if (!spec.label) errors.push(err(key, "label", "Property group label is required"));
  if (!spec.objectType) errors.push(err(key, "objectType", "Object type is required"));

  return errors;
}

export function validateProperty(spec: PropertyResourceSpec): ValidationError[] {
  const errors: ValidationError[] = [];
  const key = `property:${spec.objectType}:${spec.name}`;

  if (!spec.name) {
    errors.push(err(key, "name", "Property name is required"));
  } else {
    if (spec.name.length > propertyConstraints.maxPropertyNameLength) {
      errors.push(err(key, "name", `Name exceeds ${propertyConstraints.maxPropertyNameLength} characters`));
    }
    if (propertyConstraints.reservedPropertyNames.includes(spec.name)) {
      errors.push(err(key, "name", `"${spec.name}" is a reserved property name`));
    }
  }

  if (!spec.label) {
    errors.push(err(key, "label", "Property label is required"));
  } else if (spec.label.length > propertyConstraints.maxLabelLength) {
    errors.push(err(key, "label", `Label exceeds ${propertyConstraints.maxLabelLength} characters`));
  }

  if (!spec.type) {
    errors.push(err(key, "type", "Property type is required"));
  } else {
    const validTypes = Object.keys(propertyConstraints.propertyTypes);
    if (!validTypes.includes(spec.type)) {
      errors.push(err(key, "type", `Invalid type "${spec.type}". Valid: ${validTypes.join(", ")}`));
    }
  }

  if (!spec.fieldType) {
    errors.push(err(key, "fieldType", "Field type is required"));
  } else if (spec.type) {
    const allowedFieldTypes = (propertyConstraints.propertyTypes as Record<string, string[]>)[spec.type];
    if (allowedFieldTypes && !allowedFieldTypes.includes(spec.fieldType)) {
      errors.push(err(key, "fieldType", `Invalid fieldType "${spec.fieldType}" for type "${spec.type}". Valid: ${allowedFieldTypes.join(", ")}`));
    }
  }

  if (!spec.objectType) {
    errors.push(err(key, "objectType", "Object type is required"));
  }

  if (spec.type === "enumeration" && propertyConstraints.enumerationRequiresOptions) {
    if (!spec.options || spec.options.length === 0) {
      errors.push(err(key, "options", "Enumeration properties require at least one option"));
    }
  }

  return errors;
}

// --- Pipeline Validation ---

export function validatePipeline(spec: PipelineResourceSpec): ValidationError[] {
  const errors: ValidationError[] = [];
  const key = `pipeline:${spec.label}`;

  if (!spec.label) errors.push(err(key, "label", "Pipeline label is required"));

  if (!spec.objectType) {
    errors.push(err(key, "objectType", "Object type is required"));
  } else if (!pipelineConstraints.validObjectTypes.includes(spec.objectType)) {
    errors.push(err(key, "objectType", `Invalid object type "${spec.objectType}". Valid: ${pipelineConstraints.validObjectTypes.join(", ")}`));
  }

  if (!spec.stages || spec.stages.length === 0) {
    errors.push(err(key, "stages", "At least one stage is required"));
  } else {
    const maxStages = typeof pipelineConstraints.maxStages === "number"
      ? pipelineConstraints.maxStages
      : (pipelineConstraints.maxStages as Record<string, number>).deals_tickets_custom ?? 100;
    if (spec.stages.length > maxStages) {
      errors.push(err(key, "stages", `Exceeds maximum of ${maxStages} stages`));
    }

    spec.stages.forEach((stage, i) => {
      const stageKey = `${key}:stage[${i}]`;
      for (const field of pipelineConstraints.requiredStageFields) {
        if (!(field in stage) || (stage as unknown as Record<string, unknown>)[field] === undefined) {
          errors.push(err(stageKey, field, `Stage is missing required field "${field}"`));
        }
      }
    });
  }

  return errors;
}

// --- Workflow Validation ---

export function validateWorkflow(spec: WorkflowResourceSpec): ValidationError[] {
  const errors: ValidationError[] = [];
  const key = `workflow:${spec.name}`;

  for (const field of workflowConstraints.requiredWorkflowFields) {
    if (!(field in spec) || (spec as unknown as Record<string, unknown>)[field] === undefined) {
      errors.push(err(key, field, `Missing required field "${field}"`));
    }
  }

  if (spec.type && !workflowConstraints.validFlowTypes.includes(spec.type)) {
    errors.push(err(key, "type", `Invalid flow type "${spec.type}". Valid: ${workflowConstraints.validFlowTypes.join(", ")}`));
  }

  if (spec.actions && Array.isArray(spec.actions)) {
    const validActionTypeIds = new Set(workflowConstraints.validActionTypeIds.map((a) => a.id));
    const actionIds = new Set(spec.actions.map((a) => a.actionId));

    for (const action of spec.actions) {
      const actionKey = `${key}:action[${action.actionId}]`;

      const branchTypes = ["STATIC_BRANCH", "LIST_BRANCH", "IF_BRANCH", "UNIFIED_BRANCH"];
      const isBranch = branchTypes.includes(String(action.actionTypeId)) || branchTypes.includes(String((action as Record<string, unknown>).type));
      if (!action.actionTypeId && !isBranch) {
        errors.push(err(actionKey, "actionTypeId", "Action is missing actionTypeId"));
      } else if (isBranch) {
        // Branch actions don't use standard actionTypeId — skip validation
      } else if (!validActionTypeIds.has(action.actionTypeId)) {
        errors.push(err(actionKey, "actionTypeId", `Unknown actionTypeId "${action.actionTypeId}"`));
      } else {
        const actionDef = workflowConstraints.validActionTypeIds.find((a: { id: string }) => a.id === action.actionTypeId);
        if (actionDef) {
          const reqFields = actionDef.requiredFields;
          const fieldKeys = Array.isArray(reqFields) ? reqFields : (typeof reqFields === "object" && reqFields ? Object.keys(reqFields) : []);
          for (const reqField of fieldKeys) {
            if (!(reqField in action)) {
              errors.push(err(actionKey, reqField as string, `Action type "${actionDef.name}" requires field "${reqField}"`));
            }
          }
        }
      }

      if (action.connection?.nextActionId && !actionIds.has(action.connection.nextActionId)) {
        errors.push(err(actionKey, "connection.nextActionId", `Points to non-existent action "${action.connection.nextActionId}"`));
      }
    }
  }

  return errors;
}

// --- Custom Object Validation ---

export function validateCustomObject(spec: CustomObjectSpec): ValidationError[] {
  const errors: ValidationError[] = [];
  const key = `customObject:${spec.name}`;

  if (!spec.name) {
    errors.push(err(key, "name", "Custom object name is required"));
  } else {
    const maxNameLen = customObjectConstraints.nameConstraints?.maxLength ?? 64;
    if (spec.name.length > maxNameLen) {
      errors.push(err(key, "name", `Name exceeds ${maxNameLen} characters`));
    }
    const namePatternStr = customObjectConstraints.nameConstraints?.pattern ?? "^[a-zA-Z][a-zA-Z0-9_]*$";
    const namePattern = new RegExp(namePatternStr);
    if (!namePattern.test(spec.name)) {
      errors.push(err(key, "name", `Name must match pattern ${namePatternStr} (start with letter, alphanumeric + underscores)`));
    }
  }

  if (!spec.labels) {
    errors.push(err(key, "labels", "Labels are required"));
  } else {
    for (const field of customObjectConstraints.labelRequiredFields) {
      if (!(field in spec.labels) || !(spec.labels as Record<string, unknown>)[field]) {
        errors.push(err(key, `labels.${field}`, `Label field "${field}" is required`));
      }
    }
  }

  if (!spec.primaryDisplayProperty) {
    errors.push(err(key, "primaryDisplayProperty", "Primary display property is required"));
  }

  return errors;
}

// --- List Validation ---

export function validateList(spec: ListResourceSpec): ValidationError[] {
  const errors: ValidationError[] = [];
  const key = `list:${spec.name}`;

  if (!spec.name) errors.push(err(key, "name", "List name is required"));

  if (!spec.objectTypeId) {
    errors.push(err(key, "objectTypeId", "Object type ID is required"));
  }

  if (!spec.processingType) {
    errors.push(err(key, "processingType", "Processing type is required"));
  } else if (!listConstraints.validProcessingTypes.includes(spec.processingType)) {
    errors.push(err(key, "processingType", `Invalid processing type "${spec.processingType}". Valid: ${listConstraints.validProcessingTypes.join(", ")}`));
  }

  return errors;
}

// --- Association Validation ---

export function validateAssociation(spec: AssociationSpec): ValidationError[] {
  const errors: ValidationError[] = [];
  const key = `association:${spec.fromObjectType}->${spec.toObjectType}`;

  if (!spec.fromObjectType) errors.push(err(key, "fromObjectType", "From object type is required"));
  if (!spec.toObjectType) errors.push(err(key, "toObjectType", "To object type is required"));

  if (spec.category && !associationConstraints.validAssociationCategories.includes(spec.category)) {
    errors.push(err(key, "category", `Invalid category "${spec.category}". Valid: ${associationConstraints.validAssociationCategories.join(", ")}`));
  }

  return errors;
}

// --- Unified Validators ---

export function validateResource(type: string, spec: Record<string, unknown>): ValidationError[] {
  switch (type) {
    case "propertyGroup":
      return validatePropertyGroup(spec as unknown as PropertyGroupSpec);
    case "property":
      return validateProperty(spec as unknown as PropertyResourceSpec);
    case "pipeline":
      return validatePipeline(spec as unknown as PipelineResourceSpec);
    case "workflow":
      return validateWorkflow(spec as unknown as WorkflowResourceSpec);
    case "customObject":
      return validateCustomObject(spec as unknown as CustomObjectSpec);
    case "list":
      return validateList(spec as unknown as ListResourceSpec);
    case "association":
      return validateAssociation(spec as unknown as AssociationSpec);
    default:
      return [err(`unknown:${type}`, "type", `Unknown resource type "${type}"`)];
  }
}

export function validateTemplate(template: TemplateDefinition): ValidationResult {
  const errors: ValidationError[] = [];
  const r = template.resources;

  if (!template.name) errors.push(err("template", "name", "Template name is required"));
  if (!template.version) errors.push(err("template", "version", "Template version is required"));

  if (r.propertyGroups) {
    for (const pg of r.propertyGroups) errors.push(...validatePropertyGroup(pg));
  }
  if (r.properties) {
    for (const p of r.properties) errors.push(...validateProperty(p));
  }
  if (r.pipelines) {
    for (const p of r.pipelines) errors.push(...validatePipeline(p));
  }
  if (r.workflows) {
    for (const w of r.workflows) errors.push(...validateWorkflow(w));
  }
  if (r.lists) {
    for (const l of r.lists) errors.push(...validateList(l));
  }
  if (r.customObjects) {
    for (const co of r.customObjects) errors.push(...validateCustomObject(co));
  }
  if (r.associations) {
    for (const a of r.associations) errors.push(...validateAssociation(a));
  }

  return { valid: errors.length === 0, errors };
}
