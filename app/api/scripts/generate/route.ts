import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authManager } from "@/lib/auth-manager";
import { scriptEngine } from "@/lib/script-engine";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { prompt?: string; portalId?: string };
  if (!body.portalId || !body.prompt || !body.prompt.trim()) {
    return NextResponse.json({ ok: false, error: "portalId and prompt are required" }, { status: 400 });
  }

  const script = await authManager.withPortal(body.portalId, async () => scriptEngine.generate(body.prompt!));
  return NextResponse.json({ ok: true, script });
}
