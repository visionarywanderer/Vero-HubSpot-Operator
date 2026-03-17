import { NextResponse } from "next/server";
import { installTemplate } from "@/lib/config-executor";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { templateId: string; portalId: string; dryRun?: boolean };

    if (!body.templateId || !body.portalId) {
      return NextResponse.json(
        { error: "templateId and portalId are required" },
        { status: 400 }
      );
    }

    const report = await installTemplate(body.templateId, body.portalId, {
      dryRun: body.dryRun,
    });

    const status = report.status === "failed" ? 422 : 200;
    return NextResponse.json(report, { status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Installation failed" },
      { status: 500 }
    );
  }
}
