import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { extractPortalConfig, exportAsTemplate } from "@/lib/portal-cloner";

/**
 * POST — Extract configuration from a source portal.
 * Returns a normalized template that can be installed on another portal.
 */
export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    sourcePortalId?: string;
    options?: {
      properties?: boolean;
      pipelines?: boolean;
      workflows?: boolean;
      lists?: boolean;
      customObjects?: boolean;
      associations?: boolean;
    };
  };

  if (!body.sourcePortalId) {
    return NextResponse.json({ ok: false, error: "sourcePortalId is required" }, { status: 400 });
  }

  try {
    const config = await extractPortalConfig(body.sourcePortalId, body.options);
    const template = exportAsTemplate(config);

    return NextResponse.json({ ok: true, config, template });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
