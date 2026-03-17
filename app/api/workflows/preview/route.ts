import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { workflowEngine } from "@/lib/workflow-engine";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { spec?: Record<string, unknown> };
  if (!body.spec) {
    return NextResponse.json({ ok: false, error: "spec is required" }, { status: 400 });
  }

  const preview = workflowEngine.preview(body.spec);
  return NextResponse.json({ ok: true, preview });
}
