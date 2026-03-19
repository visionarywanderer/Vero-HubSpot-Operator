import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { listDrafts, saveDraft } from "@/lib/draft-store";
import { resolvePortalId } from "@/lib/active-portal";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let portalId: string;
  try { portalId = resolvePortalId(new URL(req.url).searchParams.get("portalId")); }
  catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "portalId required" }, { status: 400 }); }

  return NextResponse.json({ ok: true, drafts: listDrafts(portalId, "pipeline_draft") });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { portalId?: string; name?: string; spec?: Record<string, unknown> };
  if (!body.spec) return NextResponse.json({ ok: false, error: "spec is required" }, { status: 400 });
  let portalId: string;
  try { portalId = resolvePortalId(body.portalId); }
  catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "portalId required" }, { status: 400 }); }

  const name = body.name || String(body.spec.label || body.spec.name) || "Untitled Pipeline";
  const draft = saveDraft(portalId, "pipeline_draft", name, body.spec);
  return NextResponse.json({ ok: true, draft });
}
