import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { orchestrator } from "@/lib/orchestrator";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { planId?: string };
  if (!body.planId) {
    return NextResponse.json({ ok: false, error: "planId is required" }, { status: 400 });
  }

  orchestrator.cancelPlan(body.planId);
  return NextResponse.json({ ok: true });
}
