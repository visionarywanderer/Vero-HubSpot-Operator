import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { compareTemplateVersions, compareTemplateWithPortal } from "@/lib/config-diff";
import { getTemplateVersion } from "@/lib/template-versioning";
import type { TemplateResources } from "@/lib/template-types";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    mode: "versions" | "portal";
    versionIdA?: string;
    versionIdB?: string;
    resources?: TemplateResources;
    portalId?: string;
  };

  try {
    if (body.mode === "versions") {
      if (!body.versionIdA || !body.versionIdB) {
        return NextResponse.json({ ok: false, error: "versionIdA and versionIdB required" }, { status: 400 });
      }

      const a = getTemplateVersion(body.versionIdA);
      const b = getTemplateVersion(body.versionIdB);
      if (!a || !b) {
        return NextResponse.json({ ok: false, error: "Template version not found" }, { status: 404 });
      }

      const diff = compareTemplateVersions(a, b);
      return NextResponse.json({ ok: true, diff });
    }

    if (body.mode === "portal") {
      if (!body.resources || !body.portalId) {
        return NextResponse.json({ ok: false, error: "resources and portalId required" }, { status: 400 });
      }

      const diff = await compareTemplateWithPortal(body.resources, body.portalId);
      return NextResponse.json({ ok: true, diff });
    }

    return NextResponse.json({ ok: false, error: "mode must be 'versions' or 'portal'" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Diff failed" },
      { status: 500 }
    );
  }
}
