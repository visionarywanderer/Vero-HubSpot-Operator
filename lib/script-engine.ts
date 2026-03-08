import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import db from "@/lib/db";
import { getAnthropicClient } from "@/lib/anthropic";
import { saveScriptArtifact, saveScriptRunLogArtifact } from "@/lib/artifact-store";
import { authManager } from "@/lib/auth-manager";
import { changeLogger, type ChangeLogEntry } from "@/lib/change-logger";
import { canWriteInEnvironment, sanitizeSensitiveText } from "@/lib/safety-governance";

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
  generate(prompt: string): Promise<GeneratedScript>;
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

const GENERATED_ROOT = path.join(tmpdir(), "vero-generated-scripts");
const RUNS_ROOT = path.join(tmpdir(), "vero-script-runs");

const GENERATION_PROMPT = `You are a HubSpot bulk operations script generator.

Given an operation description, generate the MAIN LOGIC section of the script template.
Fill in Steps 1-5 with the specific logic for this operation.

RULES:
1. Use the provided helper functions: apiGet, apiPost, apiPatch, fetchAll, logChange, sleep
2. Process updates in batches of BATCH_SIZE (10)
3. Log every change with logChange({ recordId, action, before, after, status })
4. In DRY_RUN mode, call logChange with status 'dry_run' but don't make API calls
5. Handle errors per-record (don't stop the whole batch on one error)
6. Use batch endpoints where possible: /crm/v3/objects/{type}/batch/update
7. Always show progress during execution

OUTPUT: Only the JavaScript code for the main() function body. No markdown.`;

function detectScriptModule(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (/import|csv|upload/.test(lower)) return "F5";
  if (/export|download|extract/.test(lower)) return "F6";
  if (/duplicate/.test(lower)) return "F4";
  if (/association|link|connect/.test(lower)) return "F3";
  if (/lifecycle|stage|migrate/.test(lower)) return "F2";
  return "F1";
}

function estimateRecords(prompt: string): number {
  const match = prompt.match(/\b(\d{2,6})\b/);
  if (match) return Number(match[1]);
  if (/all\s+contacts|all\s+deals|all\s+companies/.test(prompt.toLowerCase())) return 1000;
  return 100;
}

function estimateTime(records: number): string {
  const minutes = Math.max(1, Math.ceil(records / 200));
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function buildScriptTemplate(input: {
  module: string;
  description: string;
  portalId: string;
  logicBody: string;
}): string {
  const timestamp = new Date().toISOString();

  return `#!/usr/bin/env node
/**
 * VERO HUBSPOT OPERATOR — Generated Script
 * Module: ${input.module}
 * Purpose: ${input.description}
 * Generated: ${timestamp}
 * Portal: ${input.portalId}
 * 
 * USAGE:
 *   node script.js --dry-run          # Preview changes without executing
 *   node script.js --execute          # Execute changes (requires confirmation)
 *   node script.js --execute --yes    # Skip confirmation (DANGEROUS)
 */

const axios = require('axios');
const fs = require('fs');
const readline = require('readline');

// ========== CONFIG ==========
const TOKEN = process.env.HUBSPOT_TOKEN;
if (!TOKEN) { console.error('ERROR: Set HUBSPOT_TOKEN env var'); process.exit(1); }

const BASE_URL = 'https://api.hubapi.com';
const BATCH_SIZE = 10;
const RATE_LIMIT_DELAY = 120; // ms between requests (< 100 req / 10s)
const DRY_RUN = process.argv.includes('--dry-run');
const EXECUTE = process.argv.includes('--execute');
const SKIP_CONFIRM = process.argv.includes('--yes');

if (!DRY_RUN && !EXECUTE) {
  console.log('Usage: node script.js --dry-run OR node script.js --execute');
  process.exit(0);
}

const LOG_FILE = \`log_\${new Date().toISOString().split('T')[0]}.jsonl\`;
const changes = [];

// ========== HELPERS ==========
const headers = { Authorization: \`Bearer \${TOKEN}\`, 'Content-Type': 'application/json' };

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function apiGet(p, params = {}) {
  await sleep(RATE_LIMIT_DELAY);
  const resp = await axios.get(\`\${BASE_URL}\${p}\`, { headers, params });
  return resp.data;
}

async function apiPost(p, body) {
  await sleep(RATE_LIMIT_DELAY);
  const resp = await axios.post(\`\${BASE_URL}\${p}\`, body, { headers });
  return resp.data;
}

async function apiPatch(p, body) {
  await sleep(RATE_LIMIT_DELAY);
  const resp = await axios.patch(\`\${BASE_URL}\${p}\`, body, { headers });
  return resp.data;
}

function logChange(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() });
  fs.appendFileSync(LOG_FILE, line + '\\n');
  changes.push(entry);
}

async function confirm(message) {
  if (SKIP_CONFIRM) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(\`\${message} (yes/no): \`, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function fetchAll(objectType, properties) {
  const results = [];
  let after = undefined;
  do {
    const params = { limit: 100, properties: properties.join(',') };
    if (after) params.after = after;
    const data = await apiGet(\`/crm/v3/objects/\${objectType}\`, params);
    results.push(...data.results);
    after = data.paging?.next?.after;
    process.stdout.write(\`\\r  Fetched \${results.length} records...\`);
  } while (after);
  console.log(\`\\r  Fetched \${results.length} records total.\`);
  return results;
}

// ========== MAIN LOGIC ==========
async function main() {
${input.logicBody
  .split("\n")
  .map((line) => `  ${line}`)
  .join("\n")}
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
`;
}

async function generateMainLogic(prompt: string): Promise<string> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2500,
    temperature: 0,
    system: [{ type: "text", text: GENERATION_PROMPT }],
    messages: [{ role: "user", content: prompt }]
  });

  const text = response.content
    .filter((item) => item.type === "text")
    .map((item) => (item.type === "text" ? item.text : ""))
    .join("\n");

  return text
    .replace(/^```(?:javascript)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function fallbackMainLogic(prompt: string): string {
  return `console.log('\\n=== VERO HUBSPOT OPERATOR ===');
console.log(\`Mode: \${DRY_RUN ? 'DRY RUN (no changes)' : 'EXECUTE (live changes)'}\`);
console.log(\`Log file: \${LOG_FILE}\\n\`);

console.log('Step 1: Fetching records...');
const contacts = await fetchAll('contacts', ['email', 'firstname', 'lastname']);

console.log('Step 2: Analyzing...');
const candidates = contacts.slice(0, 100).filter(c => {
  const email = c.properties?.email || '';
  return !email;
});

console.log('\\n=== SUMMARY ===');
console.log(\`Records analyzed: \${contacts.length}\`);
console.log(\`Records needing changes: \${candidates.length}\`);

for (const record of candidates) {
  logChange({
    recordId: record.id,
    action: 'analyze',
    before: { email: record.properties?.email || null },
    after: { note: 'missing email' },
    status: DRY_RUN ? 'dry_run' : 'success'
  });
}

if (DRY_RUN) {
  console.log('\\nDRY RUN complete. No changes made.');
  console.log(\`Review log: \${LOG_FILE}\`);
  return;
}

const proceed = await confirm(\`\\nProceed with \${candidates.length} changes?\`);
if (!proceed) {
  console.log('Cancelled.');
  return;
}

console.log('\\nStep 5: Executing changes...');
for (const record of candidates) {
  try {
    await apiPatch(\`/crm/v3/objects/contacts/\${record.id}\`, {
      properties: { internal_note: 'Reviewed by generated script' }
    });
    logChange({
      recordId: record.id,
      action: 'update',
      before: { internal_note: record.properties?.internal_note || null },
      after: { internal_note: 'Reviewed by generated script' },
      status: 'success'
    });
  } catch (err) {
    logChange({
      recordId: record.id,
      action: 'update',
      before: { internal_note: record.properties?.internal_note || null },
      after: { internal_note: 'Reviewed by generated script' },
      status: 'error',
      error: err.message
    });
  }
}

console.log('\\n=== COMPLETE ===');
console.log(\`Changes made: \${changes.filter(c => c.status === 'success').length}\`);
console.log(\`Errors: \${changes.filter(c => c.status === 'error').length}\`);
console.log(\`Log: \${LOG_FILE}\`);
console.log('Operation prompt:', ${JSON.stringify(prompt)});`;
}

async function ensureDirs(): Promise<void> {
  await mkdir(GENERATED_ROOT, { recursive: true });
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
  async generate(prompt: string): Promise<GeneratedScript> {
    await authManager.ensureValidatedForSession();
    await ensureDirs();

    const id = randomUUID();
    const moduleCode = detectScriptModule(prompt);
    const estimatedRecords = estimateRecords(prompt);
    const estimatedTime = estimateTime(estimatedRecords);
    const description = `Generated bulk operation for: ${prompt}`;
    const portalId = authManager.getActivePortal().id;

    let logicBody: string;
    try {
      logicBody = await generateMainLogic(sanitizeSensitiveText(prompt));
    } catch {
      logicBody = fallbackMainLogic(prompt);
    }

    const code = buildScriptTemplate({
      module: moduleCode,
      description,
      portalId,
      logicBody
    });

    const runDir = path.join(RUNS_ROOT, id);
    await mkdir(runDir, { recursive: true });

    const scriptPath = path.join(runDir, "script.js");
    await writeFile(scriptPath, code, { encoding: "utf8", mode: 0o700 });

    const scriptArtifactPath = await saveScriptArtifact(portalId, `${moduleCode}-${id}`, code);

    await saveMetadata({
      id,
      portalId,
      module: moduleCode,
      description,
      prompt,
      estimatedRecords,
      estimatedTime,
      scriptPath,
      runDir,
      scriptArtifactPath
    });

    return {
      id,
      module: moduleCode,
      description,
      code,
      readme: `Run with --dry-run first. Module ${moduleCode}. Estimated records: ${estimatedRecords}.`,
      estimatedRecords,
      estimatedTime
    };
  }

  preview(script: GeneratedScript): string {
    return [
      "━━━ SCRIPT PREVIEW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
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
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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
