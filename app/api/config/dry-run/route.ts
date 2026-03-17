import { NextResponse } from "next/server";
import { executeConfig } from "@/lib/config-executor";
import type { TemplateResources } from "@/lib/template-types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { portalId: string; resources: TemplateResources };

    if (!body.portalId || !body.resources) {
      return NextResponse.json(
        { error: "portalId and resources are required" },
        { status: 400 }
      );
    }

    const report = await executeConfig(body.portalId, body.resources, { dryRun: true });
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dry run failed" },
      { status: 500 }
    );
  }
}
