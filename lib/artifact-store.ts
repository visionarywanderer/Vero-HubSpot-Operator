import { randomUUID } from "crypto";
import db from "@/lib/db";

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "artifact"
  );
}

function artifactTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function saveArtifact(portalId: string, type: "workflows" | "scripts" | "script_logs", filename: string, content: string): Promise<string> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    "INSERT INTO artifacts(id, portal_id, type, filename, content, created_at) VALUES(?, ?, ?, ?, ?, ?)"
  ).run(id, portalId, type, filename, content, createdAt);

  return `db:artifacts/${id}/${filename}`;
}

export async function saveWorkflowSpecArtifact(portalId: string, name: string, spec: Record<string, unknown>): Promise<string> {
  const filename = `${artifactTimestamp()}_${slugify(name)}.json`;
  return saveArtifact(portalId, "workflows", filename, JSON.stringify(spec, null, 2));
}

export async function saveScriptArtifact(portalId: string, name: string, code: string): Promise<string> {
  const filename = `${artifactTimestamp()}_${slugify(name)}.js`;
  return saveArtifact(portalId, "scripts", filename, code);
}

export async function saveScriptRunLogArtifact(args: {
  portalId: string;
  scriptName: string;
  mode: "dry-run" | "execute";
  sourceLogPath: string;
}): Promise<string | undefined> {
  if (!args.sourceLogPath) return undefined;

  let contents: string;
  try {
    const fs = await import("fs/promises");
    contents = await fs.readFile(args.sourceLogPath, "utf8");
  } catch {
    return undefined;
  }

  const modeSuffix = args.mode === "dry-run" ? "dryrun" : "execute";
  const filename = `${artifactTimestamp()}_${slugify(args.scriptName)}_${modeSuffix}.log`;
  return saveArtifact(args.portalId, "script_logs", filename, contents);
}
