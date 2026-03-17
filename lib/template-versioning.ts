/**
 * Template Versioning — track versions of configuration templates
 * with full history and deployment support.
 */

import { randomUUID } from "crypto";
import db from "@/lib/db";
import type { TemplateResources } from "@/lib/template-types";

// --- Types ---

export interface TemplateVersion {
  id: string;
  templateId: string;
  version: string;
  description: string;
  resources: TemplateResources;
  createdAt: string;
  createdBy: string;
}

type TemplateVersionRow = {
  id: string;
  template_id: string;
  version: string;
  description: string | null;
  resources: string;
  created_at: string;
  created_by: string | null;
};

function rowToVersion(row: TemplateVersionRow): TemplateVersion {
  return {
    id: row.id,
    templateId: row.template_id,
    version: row.version,
    description: row.description || "",
    resources: JSON.parse(row.resources) as TemplateResources,
    createdAt: row.created_at,
    createdBy: row.created_by || "system",
  };
}

// --- Functions ---

export function createTemplateVersion(
  templateId: string,
  version: string,
  resources: TemplateResources,
  description?: string,
  createdBy?: string
): TemplateVersion {
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO template_versions (id, template_id, version, description, resources, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, templateId, version, description || "", JSON.stringify(resources), now, createdBy || "system");

  return getTemplateVersion(id)!;
}

export function getTemplateVersion(id: string): TemplateVersion | null {
  const row = db.prepare("SELECT * FROM template_versions WHERE id = ?").get(id) as TemplateVersionRow | undefined;
  return row ? rowToVersion(row) : null;
}

export function getTemplateVersionByTag(templateId: string, version: string): TemplateVersion | null {
  const row = db.prepare(
    "SELECT * FROM template_versions WHERE template_id = ? AND version = ?"
  ).get(templateId, version) as TemplateVersionRow | undefined;
  return row ? rowToVersion(row) : null;
}

export function listTemplateVersions(templateId: string): TemplateVersion[] {
  const rows = db
    .prepare("SELECT * FROM template_versions WHERE template_id = ? ORDER BY created_at DESC")
    .all(templateId) as TemplateVersionRow[];
  return rows.map(rowToVersion);
}

export function listAllTemplateIds(): string[] {
  const rows = db
    .prepare("SELECT DISTINCT template_id FROM template_versions ORDER BY template_id")
    .all() as Array<{ template_id: string }>;
  return rows.map((r) => r.template_id);
}

export function getLatestVersion(templateId: string): TemplateVersion | null {
  const row = db
    .prepare("SELECT * FROM template_versions WHERE template_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(templateId) as TemplateVersionRow | undefined;
  return row ? rowToVersion(row) : null;
}

export function deleteTemplateVersion(id: string): void {
  db.prepare("DELETE FROM template_versions WHERE id = ?").run(id);
}

/**
 * Auto-increment version string (v1 -> v2 -> v3, or 1.0.0 -> 1.0.1).
 */
export function nextVersion(templateId: string): string {
  const latest = getLatestVersion(templateId);
  if (!latest) return "v1";

  const v = latest.version;
  // Simple vN pattern
  const vMatch = v.match(/^v(\d+)$/);
  if (vMatch) return `v${parseInt(vMatch[1]) + 1}`;

  // Semver-like x.y.z
  const semMatch = v.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (semMatch) return `${semMatch[1]}.${semMatch[2]}.${parseInt(semMatch[3]) + 1}`;

  // Fallback
  return `${v}-next`;
}
