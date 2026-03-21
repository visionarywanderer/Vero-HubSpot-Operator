/**
 * Request-level property cache — avoids repeated list_properties calls
 * within the same MCP session. TTL-based (5 minutes) so stale data
 * is automatically evicted.
 */

import type { Property } from "@/lib/property-manager";

interface CacheEntry {
  properties: Property[];
  cachedAt: number;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

/** Cache key: portalId:objectType */
function key(portalId: string, objectType: string): string {
  return `${portalId}:${objectType}`;
}

export function getCachedProperties(portalId: string, objectType: string): Property[] | null {
  const entry = cache.get(key(portalId, objectType));
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    cache.delete(key(portalId, objectType));
    return null;
  }
  return entry.properties;
}

export function setCachedProperties(portalId: string, objectType: string, properties: Property[]): void {
  cache.set(key(portalId, objectType), { properties, cachedAt: Date.now() });
}

/** Invalidate cache for a specific objectType (e.g. after creating a property) */
export function invalidatePropertyCache(portalId: string, objectType: string): void {
  cache.delete(key(portalId, objectType));
}

/** Clear all cached properties (e.g. on portal switch) */
export function clearPropertyCache(): void {
  cache.clear();
}

/** Get cache stats for debugging */
export function propertyCacheStats(): { size: number; keys: string[] } {
  return { size: cache.size, keys: Array.from(cache.keys()) };
}
