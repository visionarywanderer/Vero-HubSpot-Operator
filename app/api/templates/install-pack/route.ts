import { NextResponse } from "next/server";
import { installTemplatePack } from "@/lib/config-executor";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { templateIds: string[]; portalId: string; dryRun?: boolean };

    if (!body.templateIds?.length || !body.portalId) {
      return NextResponse.json(
        { error: "templateIds (array) and portalId are required" },
        { status: 400 }
      );
    }

    const reports = await installTemplatePack(body.templateIds, body.portalId, {
      dryRun: body.dryRun,
    });

    const hasFailed = reports.some((r) => r.status === "failed");
    const status = hasFailed ? 422 : 200;
    return NextResponse.json({ reports }, { status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pack installation failed" },
      { status: 500 }
    );
  }
}
