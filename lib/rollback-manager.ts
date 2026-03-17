/**
 * Rollback Manager — creates deployment snapshots and supports
 * reverting portal configurations to previous states.
 */

import { randomUUID } from "crypto";
import db from "@/lib/db";
import { executeConfig } from "@/lib/config-executor";
import type { TemplateResources, ExecutionReport } from "@/lib/template-types";

// --- Types ---

export interface DeploymentSnapshot {
  id: string;
  portalId: string;
  templateId: string;
  templateVersion: string;
  resourcesBefore: TemplateResources | null;
  resourcesDeployed: TemplateResources;
  status: "active" | "rolled_back";
  createdAt: string;
  rolledBackAt: string | null;
}

type SnapshotRow = {
  id: string;
  portal_id: string;
  template_id: string | null;
  template_version: string | null;
  resources_before: string | null;
  resources_deployed: string;
  status: string;
  created_at: string;
  rolled_back_at: string | null;
};

function rowToSnapshot(row: SnapshotRow): DeploymentSnapshot {
  return {
    id: row.id,
    portalId: row.portal_id,
    templateId: row.template_id || "",
    templateVersion: row.template_version || "",
    resourcesBefore: row.resources_before ? (JSON.parse(row.resources_before) as TemplateResources) : null,
    resourcesDeployed: JSON.parse(row.resources_deployed) as TemplateResources,
    status: row.status as "active" | "rolled_back",
    createdAt: row.created_at,
    rolledBackAt: row.rolled_back_at,
  };
}

// --- Functions ---

export async function createDeploymentSnapshot(
  portalId: string,
  resourcesDeployed: TemplateResources,
  templateId?: string,
  templateVersion?: string,
  resourcesBefore?: TemplateResources
): Promise<string> {
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO deployment_snapshots
     (id, portal_id, template_id, template_version, resources_before, resources_deployed, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`
  ).run(
    id,
    portalId,
    templateId || null,
    templateVersion || null,
    resourcesBefore ? JSON.stringify(resourcesBefore) : null,
    JSON.stringify(resourcesDeployed),
    now
  );

  return id;
}

export function getSnapshot(id: string): DeploymentSnapshot | null {
  const row = db.prepare("SELECT * FROM deployment_snapshots WHERE id = ?").get(id) as SnapshotRow | undefined;
  return row ? rowToSnapshot(row) : null;
}

export function listSnapshots(portalId: string): DeploymentSnapshot[] {
  const rows = db
    .prepare("SELECT * FROM deployment_snapshots WHERE portal_id = ? ORDER BY created_at DESC")
    .all(portalId) as SnapshotRow[];
  return rows.map(rowToSnapshot);
}

/**
 * Rollback a deployment by re-deploying the pre-deployment snapshot.
 * If no "before" resources were captured, the rollback only marks the snapshot.
 */
export async function rollbackDeployment(
  snapshotId: string,
  dryRun = true
): Promise<{ snapshot: DeploymentSnapshot; report: ExecutionReport | null }> {
  const snapshot = getSnapshot(snapshotId);
  if (!snapshot) throw new Error(`Snapshot "${snapshotId}" not found`);
  if (snapshot.status === "rolled_back") throw new Error("Snapshot has already been rolled back");

  let report: ExecutionReport | null = null;

  if (snapshot.resourcesBefore) {
    // Re-deploy the "before" state
    report = await executeConfig(snapshot.portalId, snapshot.resourcesBefore, {
      dryRun,
      templateId: `rollback:${snapshotId}`,
    });
  }

  if (!dryRun) {
    db.prepare(
      "UPDATE deployment_snapshots SET status = 'rolled_back', rolled_back_at = ? WHERE id = ?"
    ).run(new Date().toISOString(), snapshotId);
  }

  return {
    snapshot: getSnapshot(snapshotId) ?? snapshot,
    report,
  };
}

export function deleteSnapshot(id: string): void {
  db.prepare("DELETE FROM deployment_snapshots WHERE id = ?").run(id);
}
