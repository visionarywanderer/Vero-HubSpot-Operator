import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { scriptEngine, type GeneratedScript } from "@/lib/script-engine";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { script?: GeneratedScript; mode?: "dry-run" | "execute" };
  if (!body.script || !body.mode) {
    return NextResponse.json({ ok: false, error: "script and mode are required" }, { status: 400 });
  }

  try {
    const result = await scriptEngine.execute(body.script, body.mode);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Script execution failed";
    const status = /Dry-run required|Sandbox-first policy|blocked by safety policy/i.test(message) ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
