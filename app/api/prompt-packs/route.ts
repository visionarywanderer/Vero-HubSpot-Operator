import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { readdir, readFile } from "fs/promises";
import path from "path";

const PACKS_DIR = path.join(process.cwd(), "prompt_packs");

export interface PromptPack {
  id: string;
  filename: string;
  title: string;
  purpose: string;
  content: string;
}

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1] : "Untitled";
}

function extractPurpose(content: string): string {
  const match = content.match(/## Purpose\s*\n+([\s\S]+?)(?:\n\n|\n##)/);
  return match ? match[1].trim() : "";
}

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const files = await readdir(PACKS_DIR);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    const packs: PromptPack[] = await Promise.all(
      mdFiles.map(async (filename) => {
        const content = await readFile(path.join(PACKS_DIR, filename), "utf8");
        return {
          id: filename.replace(/\.md$/, ""),
          filename,
          title: extractTitle(content),
          purpose: extractPurpose(content),
          content,
        };
      })
    );

    return NextResponse.json({ ok: true, packs });
  } catch {
    return NextResponse.json({ ok: true, packs: [] });
  }
}
