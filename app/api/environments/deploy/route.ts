import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { deployToEnvironment } from "@/lib/environment-manager";
import type { TemplateResources } from "@/lib/template-types";

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    environment?: string;
    resources?: TemplateResources;
    dryRun?: boolean;
    templateId?: string;
    templateVersion?: string;
  };

  if (!body.environment || !body.resources) {
    return NextResponse.json({ ok: false, error: "environment and resources are required" }, { status: 400 });
  }

  try {
    const result = await deployToEnvironment(body.environment, body.resources, {
      dryRun: body.dryRun !== false,
      templateId: body.templateId,
      templateVersion: body.templateVersion,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Deployment failed" },
      { status: 500 }
    );
  }
}
