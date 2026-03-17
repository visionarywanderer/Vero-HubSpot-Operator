/**
 * Configuration Diff Engine — compares configurations between portals,
 * template versions, or a template vs a portal.
 */

import { authManager } from "@/lib/auth-manager";
import { hubSpotClient } from "@/lib/api-client";
import { extractPortalConfig, type CloneOptions } from "@/lib/portal-cloner";
import { getTemplateVersionByTag, type TemplateVersion } from "@/lib/template-versioning";
import type { TemplateResources } from "@/lib/template-types";

// --- Types ---

export interface ResourceDiff {
  added: string[];
  modified: string[];
  removed: string[];
  unchanged: string[];
}

export interface ConfigDiff {
  properties: ResourceDiff;
  propertyGroups: ResourceDiff;
  pipelines: ResourceDiff;
  workflows: ResourceDiff;
  lists: ResourceDiff;
  customObjects: ResourceDiff;
  associations: ResourceDiff;
  summary: {
    totalAdded: number;
    totalModified: number;
    totalRemoved: number;
    totalUnchanged: number;
  };
}

// --- Helpers ---

function emptyDiff(): ResourceDiff {
  return { added: [], modified: [], removed: [], unchanged: [] };
}

function emptyConfigDiff(): ConfigDiff {
  return {
    properties: emptyDiff(),
    propertyGroups: emptyDiff(),
    pipelines: emptyDiff(),
    workflows: emptyDiff(),
    lists: emptyDiff(),
    customObjects: emptyDiff(),
    associations: emptyDiff(),
    summary: { totalAdded: 0, totalModified: 0, totalRemoved: 0, totalUnchanged: 0 },
  };
}

/**
 * Extract a stable key for each resource type.
 */
function resourceKey(type: string, item: Record<string, unknown>): string {
  switch (type) {
    case "propertyGroups":
      return `${item.objectType}:${item.name}`;
    case "properties":
      return `${item.objectType}:${item.name}`;
    case "pipelines":
      return `${item.objectType}:${item.label}`;
    case "workflows":
      return String(item.name);
    case "lists":
      return String(item.name);
    case "customObjects":
      return String(item.name);
    case "associations":
      return `${item.fromObjectType}->${item.toObjectType}`;
    default:
      return String(item.name || item.label || JSON.stringify(item).slice(0, 50));
  }
}

/**
 * Simple deep equality check for resource comparison.
 */
function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object") return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj).sort();
  const bKeys = Object.keys(bObj).sort();

  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key, i) => key === bKeys[i] && isDeepEqual(aObj[key], bObj[key]));
}

/**
 * Diff a single resource type between source and target.
 */
function diffResourceType(
  type: string,
  sourceItems: Record<string, unknown>[],
  targetItems: Record<string, unknown>[]
): ResourceDiff {
  const diff = emptyDiff();

  const sourceMap = new Map<string, Record<string, unknown>>();
  const targetMap = new Map<string, Record<string, unknown>>();

  for (const item of sourceItems) sourceMap.set(resourceKey(type, item), item);
  for (const item of targetItems) targetMap.set(resourceKey(type, item), item);

  // Items in source but not in target = would be added
  sourceMap.forEach((sourceItem, key) => {
    const targetItem = targetMap.get(key);
    if (!targetItem) {
      diff.added.push(key);
    } else if (!isDeepEqual(sourceItem, targetItem)) {
      diff.modified.push(key);
    } else {
      diff.unchanged.push(key);
    }
  });

  // Items in target but not in source = would be removed (or exist only in target)
  targetMap.forEach((_item, key) => {
    if (!sourceMap.has(key)) {
      diff.removed.push(key);
    }
  });

  return diff;
}

// --- Core Diff ---

/**
 * Compare two TemplateResources objects.
 * "source" represents the desired state, "target" represents the current state.
 */
export function diffResources(
  source: TemplateResources,
  target: TemplateResources
): ConfigDiff {
  const result = emptyConfigDiff();

  const types = [
    "propertyGroups",
    "properties",
    "pipelines",
    "workflows",
    "lists",
    "customObjects",
    "associations",
  ] as const;

  for (const type of types) {
    const sourceItems = (source[type] || []) as unknown as Record<string, unknown>[];
    const targetItems = (target[type] || []) as unknown as Record<string, unknown>[];
    result[type] = diffResourceType(type, sourceItems, targetItems);
  }

  // Compute summary
  for (const type of types) {
    result.summary.totalAdded += result[type].added.length;
    result.summary.totalModified += result[type].modified.length;
    result.summary.totalRemoved += result[type].removed.length;
    result.summary.totalUnchanged += result[type].unchanged.length;
  }

  return result;
}

// --- High-Level Diff Functions ---

/**
 * Compare configurations between two portals.
 */
export async function comparePortals(
  sourcePortalId: string,
  targetPortalId: string,
  cloneOptions?: Partial<CloneOptions>
): Promise<ConfigDiff> {
  const [sourceConfig, targetConfig] = await Promise.all([
    extractPortalConfig(sourcePortalId, cloneOptions),
    extractPortalConfig(targetPortalId, cloneOptions),
  ]);

  return diffResources(sourceConfig.resources, targetConfig.resources);
}

/**
 * Compare two template versions.
 */
export function compareTemplateVersions(
  versionA: TemplateVersion,
  versionB: TemplateVersion
): ConfigDiff {
  return diffResources(versionA.resources, versionB.resources);
}

/**
 * Compare a template's resources against a portal's current configuration.
 */
export async function compareTemplateWithPortal(
  templateResources: TemplateResources,
  portalId: string,
  cloneOptions?: Partial<CloneOptions>
): Promise<ConfigDiff> {
  const portalConfig = await extractPortalConfig(portalId, cloneOptions);
  return diffResources(templateResources, portalConfig.resources);
}
