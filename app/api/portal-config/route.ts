import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { portalConfigStore } from "@/lib/portal-config-store";

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const configs = await portalConfigStore.list();
  return NextResponse.json({ ok: true, configs });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { portalId?: string; config?: Record<string, unknown> };
  if (!body.portalId || !body.config) {
    return NextResponse.json({ ok: false, error: "portalId and config are required" }, { status: 400 });
  }

  await portalConfigStore.save(body.portalId, body.config as never);
  return NextResponse.json({ ok: true });
}
