import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { listDrafts, saveDraft } from "@/lib/draft-store";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const portalId = new URL(req.url).searchParams.get("portalId");
  if (!portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

  return NextResponse.json({ ok: true, drafts: listDrafts(portalId, "bulk_draft") });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { portalId?: string; name?: string; spec?: Record<string, unknown> };
  if (!body.portalId || !body.spec) {
    return NextResponse.json({ ok: false, error: "portalId and spec are required" }, { status: 400 });
  }

  const name = body.name || String(body.spec.description || body.spec.name) || "Untitled Script";
  const draft = saveDraft(body.portalId, "bulk_draft", name, body.spec);
  return NextResponse.json({ ok: true, draft });
}
