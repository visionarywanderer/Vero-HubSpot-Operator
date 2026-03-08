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

export async function PATCH(req: Request, context: any) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { updates?: Record<string, unknown>; path?: string; value?: unknown };

  if (body.updates && typeof body.updates === "object") {
    for (const [path, value] of Object.entries(body.updates)) {
      await portalConfigStore.update(params.portalId, path, value);
    }
    const config = await portalConfigStore.load(params.portalId);
    return NextResponse.json({ ok: true, config });
  }

  if (body.path && body.value !== undefined) {
    await portalConfigStore.update(params.portalId, body.path, body.value);
    const config = await portalConfigStore.load(params.portalId);
    return NextResponse.json({ ok: true, config });
  }

  return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
}
