import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { readFile } from "fs/promises";
import path from "path";

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const filePath = path.join(process.cwd(), "prompts", "prompts.json");
    const content = await readFile(filePath, "utf8");
    const prompts = JSON.parse(content);
    return NextResponse.json({ ok: true, prompts });
  } catch {
    return NextResponse.json({ ok: true, prompts: [] });
  }
}
