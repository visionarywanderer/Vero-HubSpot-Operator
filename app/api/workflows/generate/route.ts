import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authManager } from "@/lib/auth-manager";
import { workflowEngine } from "@/lib/workflow-engine";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { prompt?: string; portalId?: string };
  if (!body.portalId || !body.prompt || !body.prompt.trim()) {
    return NextResponse.json({ ok: false, error: "portalId and prompt are required" }, { status: 400 });
  }

  try {
    const spec = await authManager.withPortal(body.portalId, async () => workflowEngine.generate(body.prompt!));
    const validation = workflowEngine.validate(spec);
    const preview = workflowEngine.preview(spec);
    return NextResponse.json({ ok: true, spec, validation, preview });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to generate workflow spec" }, { status: 500 });
  }
}
