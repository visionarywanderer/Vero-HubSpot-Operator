import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { workflowEngine } from "@/lib/workflow-engine";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { spec?: Record<string, unknown> };
  if (!body.spec) {
    return NextResponse.json({ ok: false, error: "spec is required" }, { status: 400 });
  }

  const validation = workflowEngine.validate(body.spec);
  return NextResponse.json({ ok: true, validation });
}
