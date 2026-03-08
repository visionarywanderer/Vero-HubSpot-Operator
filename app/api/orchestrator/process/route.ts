import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { orchestrator } from "@/lib/orchestrator";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { prompt?: string; portalId?: string };
  if (!body.prompt || !body.prompt.trim() || !body.portalId) {
    return NextResponse.json({ ok: false, error: "prompt and portalId are required" }, { status: 400 });
  }

  try {
    const result = await orchestrator.processPrompt(body.prompt, body.portalId);
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to process prompt" }, { status: 500 });
  }
}
