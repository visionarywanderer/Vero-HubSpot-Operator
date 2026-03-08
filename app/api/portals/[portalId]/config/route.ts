import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { portalConfigStore } from "@/lib/portal-config-store";

export async function GET(_req: Request, context: any) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const config = await portalConfigStore.load(params.portalId);
  return NextResponse.json({ ok: true, config });
}

export async function PUT(req: Request, context: any) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { config?: Record<string, unknown> };
  if (!body.config) return NextResponse.json({ ok: false, error: "config is required" }, { status: 400 });

  await portalConfigStore.save(params.portalId, body.config as never);
  return NextResponse.json({ ok: true });
}
