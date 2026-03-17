import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import db from "@/lib/db";
import { saveScriptArtifact, saveScriptRunLogArtifact } from "@/lib/artifact-store";
import { authManager } from "@/lib/auth-manager";
import { changeLogger, type ChangeLogEntry } from "@/lib/change-logger";
import { canWriteInEnvironment } from "@/lib/safety-governance";

export interface GeneratedScript {
  id: string;
  module: string;
  description: string;
  code: string;
  readme: string;
  estimatedRecords: number;
  estimatedTime: string;
}

export interface ScriptResult {
  scriptId: string;
  mode: "dry-run" | "execute";
  recordsAnalyzed: number;
  recordsChanged: number;
  errors: number;
  logFile: string;
  duration: string;
}

export interface ScriptRunner {
  /**
   * Register a script from externally-generated code.
   * AI generation has been removed — scripts are now provided by external Claude Skills.
   */
  register(input: { code: string; module?: string; description?: string }): Promise<GeneratedScript>;
  preview(script: GeneratedScript): string;
  execute(script: GeneratedScript, mode: "dry-run" | "execute"): Promise<ScriptResult>;
  getLog(scriptId: string): Promise<ChangeLogEntry[]>;
}

type ScriptMetadata = {
  id: string;
  portalId: string;
  module: string;
  description: string;
  prompt: string;
  estimatedRecords: number;
  estimatedTime: string;
  scriptPath: string;
  runDir: string;
  scriptArtifactPath?: string;
  dryRunCompletedAt?: string;
  dryRunLogArtifactPath?: string;
  executeLogArtifactPath?: string;
};

const RUNS_ROOT = path.join(tmpdir(), "vero-script-runs");

function detectScriptModule(code: string): string {
  const lower = code.toLowerCase();
  if (/import|csv|upload/.test(lower)) return "F5";
  if (/export|download|extract/.test(lower)) return "F6";
  if (/duplicate/.test(lower)) return "F4";
  if (/association|link|connect/.test(lower)) return "F3";
  if (/lifecycle|stage|migrate/.test(lower)) return "F2";
  return "F1";
}

function estimateTime(records: number): string {
  const minutes = Math.max(1, Math.ceil(records / 200));
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

async function ensureDirs(): Promise<void> {
  await mkdir(RUNS_ROOT, { recursive: true });
}

async function saveMetadata(metadata: ScriptMetadata): Promise<void> {
  await ensureDirs();
  db.prepare(
    "INSERT INTO script_metadata(id, metadata, updated_at) VALUES(?, ?, ?) ON CONFLICT(id) DO UPDATE SET metadata = excluded.metadata, updated_at = excluded.updated_at"
  ).run(metadata.id, JSON.stringify(metadata), new Date().toISOString());
}

async function loadMetadata(scriptId: string): Promise<ScriptMetadata> {
  const row = db.prepare("SELECT metadata FROM script_metadata WHERE id = ?").get(scriptId) as { metadata: string } | undefined;
  if (!row) throw new Error("Script metadata not found");
  return JSON.parse(row.metadata) as ScriptMetadata;
}

async function readLogFile(logFilePath: string): Promise<Array<Record<string, unknown>>> {
  try {
    const raw = await readFile(logFilePath, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  } catch {
    return [];
  }
}

function durationToString(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remSeconds}s` : `${remSeconds}s`;
}

class HubSpotScriptEngine implements ScriptRunner {
  async register(input: { code: string; module?: string; description?: string }): Promise<GeneratedScript> {
    await authManager.ensureValidatedForSession();
    await ensureDirs();

    const id = randomUUID();
    const moduleCode = input.module || detectScriptModule(input.code);
    const description = input.description || "Externally generated bulk operation script";
    const portalId = authManager.getActivePortal().id;
    const estimatedRecords = 100;

    const runDir = path.join(RUNS_ROOT, id);
    await mkdir(runDir, { recursive: true });

    const scriptPath = path.join(runDir, "script.js");
    await writeFile(scriptPath, input.code, { encoding: "utf8", mode: 0o700 });

    const scriptArtifactPath = await saveScriptArtifact(portalId, `${moduleCode}-${id}`, input.code);

    await saveMetadata({
      id,
      portalId,
      module: moduleCode,
      description,
      prompt: description,
      estimatedRecords,
      estimatedTime: estimateTime(estimatedRecords),
      scriptPath,
      runDir,
      scriptArtifactPath
    });

    return {
      id,
      module: moduleCode,
      description,
      code: input.code,
      readme: `Run with --dry-run first. Module ${moduleCode}.`,
      estimatedRecords,
      estimatedTime: estimateTime(estimatedRecords)
    };
  }

  preview(script: GeneratedScript): string {
    return [
      "--- SCRIPT PREVIEW ---",
      `ID: ${script.id}`,
      `Module: ${script.module}`,
      `Description: ${script.description}`,
      `Estimated records: ${script.estimatedRecords}`,
      `Estimated time: ${script.estimatedTime}`,
      "",
      "Safety:",
      "- Review script code before execute",
      "- Run dry-run first",
      "- Execute only with confirmation",
      "----------------------"
    ].join("\n");
  }

  async execute(script: GeneratedScript, mode: "dry-run" | "execute"): Promise<ScriptResult> {
    const metadata = await loadMetadata(script.id);
    const runtimePortalId = metadata.portalId;
    const isFirstSession = authManager.isFirstSessionForActivePortal(runtimePortalId);
    await authManager.ensureValidatedForSession(runtimePortalId);

    const portal = authManager.getActivePortal(runtimePortalId);
    if (mode === "execute") {
      const writeGate = canWriteInEnvironment({
        environment: portal.environment,
        isFirstSession,
        isWriteOperation: true
      });
      if (!writeGate.allowed) {
        throw new Error(writeGate.reason || "Write operation blocked by safety policy");
      }
    }
    if (mode === "execute" && !metadata.dryRunCompletedAt) {
      throw new Error("Dry-run required before execute. Run this script in dry-run mode first.");
    }

    const start = Date.now();
    const token = authManager.getToken(runtimePortalId);

    const args = mode === "dry-run" ? [metadata.scriptPath, "--dry-run"] : [metadata.scriptPath, "--execute", "--yes"];

    const outputChunks: string[] = [];
    const errorChunks: string[] = [];

    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn("node", args, {
        cwd: metadata.runDir,
        env: {
          ...process.env,
          HUBSPOT_TOKEN: token
        }
      });

      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("Script exceeded 30 minute timeout"));
      }, 30 * 60 * 1000);

      child.stdout.on("data", (chunk) => outputChunks.push(String(chunk)));
      child.stderr.on("data", (chunk) => errorChunks.push(String(chunk)));

      child.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      child.on("close", (code) => {
        clearTimeout(timeout);
        resolve(code ?? 1);
      });
    });

    const files = await readdir(metadata.runDir);
    const logCandidate = files
      .filter((name) => name.startsWith("log_") && name.endsWith(".jsonl"))
      .sort()
      .at(-1);

    const logFilePath = logCandidate ? path.join(metadata.runDir, logCandidate) : "";
    const portalId = runtimePortalId;
    const logArtifactPath = await saveScriptRunLogArtifact({
      portalId,
      scriptName: `${metadata.module}-${script.id}`,
      mode,
      sourceLogPath: logFilePath
    });

    const logs = logFilePath ? await readLogFile(logFilePath) : [];

    const successCount = logs.filter((entry) => String(entry.status) === "success").length;
    const dryRunCount = logs.filter((entry) => String(entry.status) === "dry_run").length;
    const errorCount = logs.filter((entry) => String(entry.status) === "error").length;

    const recordsAnalyzed = logs.length;
    const recordsChanged = mode === "dry-run" ? dryRunCount : successCount;

    const duration = durationToString(Date.now() - start);

    if (exitCode !== 0) {
      await changeLogger.log({
        portalId,
        layer: "script",
        module: metadata.module,
        action: "script_execute",
        objectType: "script",
        recordId: script.id,
        description: `Script ${script.id} failed in ${mode} mode`,
        status: "error",
        error: errorChunks.join("\n") || outputChunks.join("\n") || `Exit code ${exitCode}`,
        initiatedBy: `script:${metadata.module}`,
        prompt: metadata.prompt
      });

      throw new Error(`Script exited with code ${exitCode}`);
    }
    if (mode === "dry-run") {
      metadata.dryRunCompletedAt = new Date().toISOString();
      metadata.dryRunLogArtifactPath = logArtifactPath;
    } else {
      metadata.executeLogArtifactPath = logArtifactPath;
    }
    await saveMetadata(metadata);

    await changeLogger.log({
      portalId,
      layer: "script",
      module: metadata.module,
      action: "script_execute",
      objectType: "script",
      recordId: script.id,
      description: `Script ${script.id} completed in ${mode} mode`,
      after: { recordsAnalyzed, recordsChanged, errors: errorCount, logFile: logFilePath, artifactLogFile: logArtifactPath },
      status: mode === "dry-run" ? "dry_run" : "success",
      initiatedBy: `script:${metadata.module}`,
      prompt: metadata.prompt
    });

    return {
      scriptId: script.id,
      mode,
      recordsAnalyzed,
      recordsChanged,
      errors: errorCount,
      logFile: logFilePath,
      duration
    };
  }

  async getLog(scriptId: string): Promise<ChangeLogEntry[]> {
    const metadata = await loadMetadata(scriptId);
    const files = await readdir(metadata.runDir);
    const logCandidate = files
      .filter((name) => name.startsWith("log_") && name.endsWith(".jsonl"))
      .sort()
      .at(-1);

    if (!logCandidate) {
      return [];
    }

    const logFilePath = path.join(metadata.runDir, logCandidate);
    const lines = await readLogFile(logFilePath);

    return lines.map((line, index) => ({
      id: `${scriptId}-${index + 1}`,
      timestamp: String(line.timestamp || new Date().toISOString()),
      portalId: metadata.portalId,
      layer: "script",
      module: metadata.module,
      action: "script_execute",
      objectType: "script_record",
      recordId: String(line.recordId || "unknown"),
      description: String(line.action || "script change"),
      before: (line.before as object | undefined) ?? undefined,
      after: (line.after as object | undefined) ?? undefined,
      status: (line.status as "success" | "error" | "dry_run") || "success",
      error: (line.error as string | undefined) ?? undefined,
      initiatedBy: `script:${metadata.module}`,
      prompt: metadata.prompt
    }));
  }
}

export const scriptEngine: ScriptRunner = new HubSpotScriptEngine();
