import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { comparePortals } from "@/lib/config-diff";

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    sourcePortalId?: string;
    targetPortalId?: string;
    options?: {
      properties?: boolean;
      pipelines?: boolean;
      workflows?: boolean;
      lists?: boolean;
      customObjects?: boolean;
      associations?: boolean;
    };
  };

  if (!body.sourcePortalId || !body.targetPortalId) {
    return NextResponse.json({ ok: false, error: "sourcePortalId and targetPortalId are required" }, { status: 400 });
  }

  try {
    const diff = await comparePortals(body.sourcePortalId, body.targetPortalId, body.options);
    return NextResponse.json({ ok: true, diff });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Diff failed" },
      { status: 500 }
    );
  }
}
