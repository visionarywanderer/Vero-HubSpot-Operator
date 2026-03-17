import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { deleteDraft, getDraft } from "@/lib/draft-store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const portalId = new URL(req.url).searchParams.get("portalId");
  if (!portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

  const draft = getDraft(id, "list_draft", portalId);
  if (!draft) return NextResponse.json({ ok: false, error: "Draft not found" }, { status: 404 });
  return NextResponse.json({ ok: true, draft });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const portalId = new URL(req.url).searchParams.get("portalId");
  if (!portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

  deleteDraft(id, "list_draft", portalId);
  return NextResponse.json({ ok: true });
}
