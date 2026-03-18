import { NextResponse } from "next/server";
import { installTemplate, executeConfig } from "@/lib/config-executor";
import type { TemplateResources } from "@/lib/template-types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      templateId?: string;
      portalId?: string;
      resources?: TemplateResources;
      dryRun?: boolean;
    };

    if (!body.portalId) {
      return NextResponse.json({ error: "portalId is required" }, { status: 400 });
    }

    // Support both: templateId (file-based) and resources (draft-based)
    let report;
    if (body.resources) {
      report = await executeConfig(body.portalId, body.resources, { dryRun: body.dryRun });
    } else if (body.templateId) {
      report = await installTemplate(body.templateId, body.portalId, { dryRun: body.dryRun });
    } else {
      return NextResponse.json({ error: "templateId or resources required" }, { status: 400 });
    }

    const status = report.status === "failed" ? 422 : 200;
    return NextResponse.json(report, { status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Installation failed" },
      { status: 500 }
    );
  }
}
