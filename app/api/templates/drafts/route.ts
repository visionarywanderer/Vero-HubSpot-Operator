import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { listDrafts, saveDraft } from "@/lib/draft-store";

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const portalId = new URL(req.url).searchParams.get("portalId");
  if (!portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

  return NextResponse.json({ ok: true, drafts: listDrafts(portalId, "template_draft") });
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { portalId?: string; name?: string; spec?: Record<string, unknown> };
  if (!body.portalId || !body.spec) {
    return NextResponse.json({ ok: false, error: "portalId and spec are required" }, { status: 400 });
  }

  const name = body.name || String(body.spec.name || body.spec.id) || "Untitled Template";
  const draft = saveDraft(body.portalId, "template_draft", name, body.spec);
  return NextResponse.json({ ok: true, draft });
}
