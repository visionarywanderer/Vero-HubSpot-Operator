import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { listManager } from "@/lib/list-manager";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const portalId = new URL(req.url).searchParams.get("portalId");
  if (!portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

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

  if (!body.portalId || !body.spec) {
    return NextResponse.json({ ok: false, error: "portalId and spec are required" }, { status: 400 });
  }

  const list = await authManager.withPortal(body.portalId, async () => listManager.create(body.spec!));
  return NextResponse.json({ ok: true, list });
}
