import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { clonePortal } from "@/lib/portal-cloner";

/**
 * POST — Clone configuration from source portal to target portal.
 * Supports dry-run mode (default) to preview changes before executing.
 */
export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    sourcePortalId?: string;
    targetPortalId?: string;
    dryRun?: boolean;
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
    return NextResponse.json(
      { ok: false, error: "sourcePortalId and targetPortalId are required" },
      { status: 400 }
    );
  }

  if (body.sourcePortalId === body.targetPortalId) {
    return NextResponse.json(
      { ok: false, error: "Source and target portals must be different" },
      { status: 400 }
    );
  }

  try {
    const result = await clonePortal(
      body.sourcePortalId,
      body.targetPortalId,
      body.options,
      body.dryRun !== false // Default to dry-run
    );

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Clone failed" },
      { status: 500 }
    );
  }
}
