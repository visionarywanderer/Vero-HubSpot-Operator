import { randomUUID } from "crypto";
import db from "@/lib/db";

export interface Draft {
  id: string;
  name: string;
  spec: Record<string, unknown>;
  createdAt: string;
}

export type DraftType =
  | "workflow_draft"
  | "pipeline_draft"
  | "property_draft"
  | "list_draft"
  | "template_draft"
  | "bulk_draft"
  | "clone_draft"
  | "custom_object_draft";

export interface ConflictReport {
  hasDraftConflict: boolean;
  hasPortalConflict: boolean;
  draftConflicts: { id: string; name: string; createdAt: string }[];
  portalConflicts: { name: string; label?: string; match: "exact" | "similar" }[];
}

export function listDrafts(portalId: string, type: DraftType): Draft[] {
  const rows = db
    .prepare(
      "SELECT id, filename, content, created_at FROM artifacts WHERE portal_id = ? AND type = ? ORDER BY created_at DESC"
    )
    .all(portalId, type) as { id: string; filename: string; content: string; created_at: string }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.filename,
    spec: JSON.parse(r.content),
    createdAt: r.created_at,
  }));
}

/** Check for existing drafts with the same or similar name. */
export function findDraftConflicts(
  portalId: string,
  type: DraftType,
  name: string,
  specKey?: string,
): ConflictReport["draftConflicts"] {
  const existing = listDrafts(portalId, type);
  const normalised = name.toLowerCase().trim();

  return existing
    .filter((d) => {
      const dName = d.name.toLowerCase().trim();
      if (dName === normalised) return true;
      // Also match by spec key (e.g. property internal name)
      if (specKey) {
        const dKey = String(d.spec.name || d.spec.label || "").toLowerCase().trim();
        if (dKey === specKey.toLowerCase().trim()) return true;
      }
      return false;
    })
    .map((d) => ({ id: d.id, name: d.name, createdAt: d.createdAt }));
}

export function saveDraft(portalId: string, type: DraftType, name: string, spec: Record<string, unknown>): Draft {
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    "INSERT INTO artifacts(id, portal_id, type, filename, content, created_at) VALUES(?, ?, ?, ?, ?, ?)"
  ).run(id, portalId, type, name, JSON.stringify(spec, null, 2), createdAt);

  return { id, name, spec, createdAt };
}

export function deleteDraft(id: string, type: DraftType, portalId: string): void {
  db.prepare("DELETE FROM artifacts WHERE id = ? AND type = ? AND portal_id = ?").run(id, type, portalId);
}

export function getDraft(id: string, type: DraftType, portalId: string): Draft | null {
  const row = db
    .prepare("SELECT id, filename, content, created_at FROM artifacts WHERE id = ? AND type = ? AND portal_id = ?")
    .get(id, type, portalId) as { id: string; filename: string; content: string; created_at: string } | undefined;

  if (!row) return null;
  return { id: row.id, name: row.filename, spec: JSON.parse(row.content), createdAt: row.created_at };
}
