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

    const report = await executeConfig(body.portalId, body.resources);

    const status = report.status === "failed" ? 422 : 200;
    return NextResponse.json(report, { status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Execution failed" },
      { status: 500 }
    );
  }
}
