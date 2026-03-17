import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { scriptEngine, type GeneratedScript } from "@/lib/script-engine";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { script?: GeneratedScript };
  if (!body.script) {
    return NextResponse.json({ ok: false, error: "script is required" }, { status: 400 });
  }

  const preview = scriptEngine.preview(body.script);
  return NextResponse.json({ ok: true, preview });
}
