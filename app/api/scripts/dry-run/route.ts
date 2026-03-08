import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { scriptEngine, type GeneratedScript } from "@/lib/script-engine";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { script?: GeneratedScript };
  if (!body.script) {
    return NextResponse.json({ ok: false, error: "script is required" }, { status: 400 });
  }

  try {
    const result = await scriptEngine.execute(body.script, "dry-run");
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "dry-run failed" }, { status: 500 });
  }
}
