import db from "./db";

/**
 * Active Portal helpers
 *
 * The "active portal" is a session-level selection stored in app_settings
 * (key = "active_portal_id", value = portal's internal SQLite id).
 *
 * API routes call resolvePortalId(raw) to get a definitive portalId:
 *   1. If `raw` is provided in the request, use it directly.
 *   2. Otherwise fall back to the active portal stored here.
 *   3. Throw if neither is available — surfaces a clear error to the caller.
 *
 * MCP tools call set_active_portal once per session; subsequent tool calls
 * can omit portalId entirely and the app handles resolution transparently.
 */

/** Return the currently active portal's internal ID, or null if unset. */
export function getActivePortalId(): string | null {
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get("active_portal_id") as { value: string } | undefined;
  return row?.value ?? null;
}

/** Persist a new active portal by internal ID. */
export function setActivePortalId(portalId: string): void {
  db.prepare(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)"
  ).run("active_portal_id", portalId);
}

/** Clear the active portal selection. */
export function clearActivePortal(): void {
  db.prepare("DELETE FROM app_settings WHERE key = ?").run("active_portal_id");
}

/**
 * Resolve a portalId for use in API route handlers.
 *
 * Preference order:
 *   1. `requested` — value from the request (query param or body field)
 *   2. Active portal stored in app_settings
 *
 * Throws a descriptive Error if neither is available, which callers should
 * catch and return as a 400 response.
 */
export function resolvePortalId(requested?: string | null): string {
  const id = requested || getActivePortalId();
  if (!id) {
    throw new Error(
      "No portalId provided and no active portal is set. " +
        "Pass portalId explicitly, or call set_active_portal first."
    );
  }
  return id;
}
