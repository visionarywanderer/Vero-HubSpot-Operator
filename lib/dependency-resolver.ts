/**
 * Dependency Resolver — builds a DAG of template resources and returns
 * them in topological execution order (Kahn's algorithm).
 *
 * Dependency graph:
 *   propertyGroup → property
 *   property      → workflow, list
 *   pipeline      → workflow
 *   customObject  → association
 */

import type {
  TemplateResources,
  ResolvedResource,
  ResourceType,
} from "@/lib/template-types";

interface GraphNode {
  resource: ResolvedResource;
  inDegree: number;
}

/**
 * Build a unique key for a resource so dependencies can reference it.
 */
function resourceKey(type: ResourceType, spec: Record<string, unknown>): string {
  switch (type) {
    case "propertyGroup":
      return `propertyGroup:${spec.name}`;
    case "property":
      return `property:${spec.objectType}:${spec.name}`;
    case "pipeline":
      return `pipeline:${spec.objectType}:${spec.label}`;
    case "workflow":
      return `workflow:${spec.name}`;
    case "list":
      return `list:${spec.name}`;
    case "customObject":
      return `customObject:${spec.name}`;
    case "association":
      return `association:${spec.fromObjectType}->${spec.toObjectType}`;
    default:
      return `${type}:${spec.name || spec.label || "unknown"}`;
  }
}

/**
 * Determine which other resource keys a given resource depends on.
 */
function computeDependencies(
  type: ResourceType,
  spec: Record<string, unknown>,
  allKeysArray: string[]
): string[] {
  const deps: string[] = [];

  switch (type) {
    case "property": {
      const groupKey = `propertyGroup:${spec.groupName}`;
      if (spec.groupName && allKeysArray.indexOf(groupKey) !== -1) {
        deps.push(groupKey);
      }
      break;
    }

    case "workflow": {
      // Workflows depend on properties (they may reference custom properties)
      // but NOT on pipelines — pipelines and workflows are independent
      allKeysArray.forEach((k) => {
        if (k.startsWith("property:")) {
          deps.push(k);
        }
      });
      break;
    }

    case "list": {
      allKeysArray.forEach((k) => {
        if (k.startsWith("property:")) {
          deps.push(k);
        }
      });
      break;
    }

    case "association": {
      const fromKey = `customObject:${spec.fromObjectType}`;
      const toKey = `customObject:${spec.toObjectType}`;
      if (allKeysArray.indexOf(fromKey) !== -1) deps.push(fromKey);
      if (allKeysArray.indexOf(toKey) !== -1) deps.push(toKey);
      break;
    }
  }

  return deps;
}

/**
 * Flatten template resources into an array of ResolvedResource entries.
 */
function flattenResources(resources: TemplateResources): Array<{ type: ResourceType; spec: Record<string, unknown> }> {
  const flat: Array<{ type: ResourceType; spec: Record<string, unknown> }> = [];

  if (resources.propertyGroups) {
    resources.propertyGroups.forEach((pg) => flat.push({ type: "propertyGroup", spec: pg as unknown as Record<string, unknown> }));
  }
  if (resources.properties) {
    resources.properties.forEach((p) => flat.push({ type: "property", spec: p as unknown as Record<string, unknown> }));
  }
  if (resources.pipelines) {
    resources.pipelines.forEach((p) => flat.push({ type: "pipeline", spec: p as unknown as Record<string, unknown> }));
  }
  if (resources.workflows) {
    resources.workflows.forEach((w) => flat.push({ type: "workflow", spec: w as unknown as Record<string, unknown> }));
  }
  if (resources.lists) {
    resources.lists.forEach((l) => flat.push({ type: "list", spec: l as unknown as Record<string, unknown> }));
  }
  if (resources.customObjects) {
    resources.customObjects.forEach((co) => flat.push({ type: "customObject", spec: co as unknown as Record<string, unknown> }));
  }
  if (resources.associations) {
    resources.associations.forEach((a) => flat.push({ type: "association", spec: a as unknown as Record<string, unknown> }));
  }

  return flat;
}

/**
 * Build adjacency list from resource definitions.
 */
export function buildResourceGraph(resources: TemplateResources): Map<string, ResolvedResource> {
  const flat = flattenResources(resources);

  // First pass: collect all keys
  const allKeysArray: string[] = [];
  const entries: Array<{ type: ResourceType; spec: Record<string, unknown>; key: string }> = [];
  flat.forEach((item) => {
    const key = resourceKey(item.type, item.spec);
    allKeysArray.push(key);
    entries.push({ ...item, key });
  });

  // Second pass: compute dependencies
  const graph = new Map<string, ResolvedResource>();
  entries.forEach((entry) => {
    const dependsOn = computeDependencies(entry.type, entry.spec, allKeysArray);
    graph.set(entry.key, {
      type: entry.type,
      spec: entry.spec,
      dependsOn,
      key: entry.key,
    });
  });

  return graph;
}

/**
 * Topological sort using Kahn's algorithm.
 * Returns resources in dependency-safe execution order.
 * Throws if a cycle is detected.
 */
export function topologicalSort(graph: Map<string, ResolvedResource>): ResolvedResource[] {
  const nodes = new Map<string, GraphNode>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  graph.forEach((resource, key) => {
    nodes.set(key, { resource, inDegree: 0 });
    if (!adjacency.has(key)) adjacency.set(key, []);
  });

  // Build in-degree counts and reverse adjacency
  graph.forEach((resource, key) => {
    resource.dependsOn.forEach((dep) => {
      if (nodes.has(dep)) {
        const node = nodes.get(key)!;
        node.inDegree++;
        adjacency.get(dep)!.push(key);
      }
    });
  });

  // Collect nodes with in-degree 0
  const queue: string[] = [];
  nodes.forEach((node, key) => {
    if (node.inDegree === 0) queue.push(key);
  });

  const sorted: ResolvedResource[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(nodes.get(current)!.resource);

    const dependents = adjacency.get(current) || [];
    dependents.forEach((dependent) => {
      const depNode = nodes.get(dependent)!;
      depNode.inDegree--;
      if (depNode.inDegree === 0) queue.push(dependent);
    });
  }

  if (sorted.length !== nodes.size) {
    const remaining = Array.from(nodes.keys()).filter(
      (key) => !sorted.some((r) => r.key === key)
    );
    throw new Error(`Dependency cycle detected involving: ${remaining.join(", ")}`);
  }

  return sorted;
}

/**
 * Resolve all dependencies in a template and return resources in execution order.
 */
export function resolveDependencies(resources: TemplateResources): ResolvedResource[] {
  const graph = buildResourceGraph(resources);
  return topologicalSort(graph);
}
