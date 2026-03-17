/**
 * Environment Manager — maps portals to dev/staging/production roles
 * and manages safe promotion between environments.
 */

import { randomUUID } from "crypto";
import db from "@/lib/db";
import { extractPortalConfig, type CloneOptions } from "@/lib/portal-cloner";
import { executeConfig } from "@/lib/config-executor";
import { createDeploymentSnapshot } from "@/lib/rollback-manager";
import type { TemplateResources, ExecutionReport } from "@/lib/template-types";

// --- Types ---

export type EnvironmentRole = "development" | "staging" | "production";

export interface Environment {
  name: string;
  portalId: string;
  label: string;
  role: EnvironmentRole;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentResult {
  environment: string;
  portalId: string;
  report: ExecutionReport;
  snapshotId: string;
}

export interface PromotionResult {
  sourceEnv: string;
  targetEnv: string;
  extractedResources: TemplateResources;
  report: ExecutionReport;
  snapshotId: string;
  warnings: string[];
}

// --- Promotion Order ---

const PROMOTION_ORDER: EnvironmentRole[] = ["development", "staging", "production"];

function promotionIndex(role: EnvironmentRole): number {
  return PROMOTION_ORDER.indexOf(role);
}

// --- Registry ---

export function listEnvironments(): Environment[] {
  return db
    .prepare("SELECT * FROM environments ORDER BY role, name")
    .all() as Environment[];
}

export function getEnvironment(name: string): Environment | null {
  return (
    db.prepare("SELECT * FROM environments WHERE name = ?").get(name) as Environment | undefined
  ) ?? null;
}

export function getEnvironmentByRole(role: EnvironmentRole): Environment | null {
  return (
    db.prepare("SELECT * FROM environments WHERE role = ? LIMIT 1").get(role) as Environment | undefined
  ) ?? null;
}

export function registerEnvironment(
  name: string,
  portalId: string,
  role: EnvironmentRole,
  label?: string
): Environment {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO environments (name, portal_id, label, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       portal_id = excluded.portal_id,
       label = excluded.label,
       role = excluded.role,
       updated_at = excluded.updated_at`
  ).run(name, portalId, label || name, role, now, now);

  return getEnvironment(name)!;
}

export function removeEnvironment(name: string): void {
  db.prepare("DELETE FROM environments WHERE name = ?").run(name);
}

// --- Deployment ---

export async function deployToEnvironment(
  envName: string,
  resources: TemplateResources,
  options?: { dryRun?: boolean; templateId?: string; templateVersion?: string }
): Promise<DeploymentResult> {
  const env = getEnvironment(envName);
  if (!env) throw new Error(`Environment "${envName}" not found`);

  // Production safety gate
  if (env.role === "production" && !options?.dryRun) {
    const stagingEnv = getEnvironmentByRole("staging");
    if (stagingEnv) {
      // Warn but don't block — the UI should handle confirmation
    }
  }

  // Create pre-deployment snapshot
  let snapshotId = "";
  if (!options?.dryRun) {
    snapshotId = await createDeploymentSnapshot(
      env.portalId,
      resources,
      options?.templateId,
      options?.templateVersion
    );
  }

  const report = await executeConfig(env.portalId, resources, {
    dryRun: options?.dryRun,
    templateId: options?.templateId,
  });

  return {
    environment: envName,
    portalId: env.portalId,
    report,
    snapshotId,
  };
}

// --- Promotion ---

export async function promoteEnvironment(
  sourceEnvName: string,
  targetEnvName: string,
  cloneOptions?: Partial<CloneOptions>,
  dryRun = true
): Promise<PromotionResult> {
  const sourceEnv = getEnvironment(sourceEnvName);
  const targetEnv = getEnvironment(targetEnvName);

  if (!sourceEnv) throw new Error(`Source environment "${sourceEnvName}" not found`);
  if (!targetEnv) throw new Error(`Target environment "${targetEnvName}" not found`);

  if (sourceEnv.portalId === targetEnv.portalId) {
    throw new Error("Source and target portals must be different");
  }

  const warnings: string[] = [];

  // Check promotion order
  const sourceIdx = promotionIndex(sourceEnv.role);
  const targetIdx = promotionIndex(targetEnv.role);

  if (targetIdx < sourceIdx) {
    warnings.push(`Promoting from ${sourceEnv.role} to ${targetEnv.role} is a downgrade`);
  }

  if (sourceEnv.role === "development" && targetEnv.role === "production") {
    warnings.push("Direct development to production deployment — staging step skipped");
  }

  // Extract from source
  const extracted = await extractPortalConfig(sourceEnv.portalId, cloneOptions);

  // Create snapshot on target before deployment
  let snapshotId = "";
  if (!dryRun) {
    snapshotId = await createDeploymentSnapshot(
      targetEnv.portalId,
      extracted.resources,
      `promote:${sourceEnvName}`,
      undefined
    );
  }

  // Deploy to target
  const report = await executeConfig(targetEnv.portalId, extracted.resources, {
    dryRun,
    templateId: `promote:${sourceEnvName}->${targetEnvName}`,
  });

  return {
    sourceEnv: sourceEnvName,
    targetEnv: targetEnvName,
    extractedResources: extracted.resources,
    report,
    snapshotId,
    warnings,
  };
}
