import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { listManager } from "@/lib/list-manager";
import { resolvePortalId } from "@/lib/active-portal";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let portalId: string;
  try { portalId = resolvePortalId(new URL(req.url).searchParams.get("portalId")); }
  catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "portalId required" }, { status: 400 }); }

  const lists = await authManager.withPortal(portalId, async () => listManager.list());
  return NextResponse.json({ ok: true, lists });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    portalId?: string;
    spec?: {
      name: string;
      objectTypeId: string;
      processingType: "DYNAMIC" | "MANUAL";
      filterBranch?: Record<string, unknown>;
    };
  };

  if (!body.spec) return NextResponse.json({ ok: false, error: "spec is required" }, { status: 400 });
  let portalIdPost: string;
  try { portalIdPost = resolvePortalId(body.portalId); }
  catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "portalId required" }, { status: 400 }); }

  const list = await authManager.withPortal(portalIdPost, async () => listManager.create(body.spec!));
  return NextResponse.json({ ok: true, list });
}
