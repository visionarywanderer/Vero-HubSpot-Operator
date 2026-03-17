import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import {
  createTemplateVersion,
  listAllTemplateIds,
  nextVersion,
} from "@/lib/template-versioning";
import type { TemplateResources } from "@/lib/template-types";

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ ok: true, templateIds: listAllTemplateIds() });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    templateId?: string;
    version?: string;
    resources?: TemplateResources;
    description?: string;
  };

  if (!body.templateId || !body.resources) {
    return NextResponse.json({ ok: false, error: "templateId and resources are required" }, { status: 400 });
  }

  const version = body.version || nextVersion(body.templateId);
  const tv = createTemplateVersion(
    body.templateId,
    version,
    body.resources,
    body.description,
    undefined
  );

  return NextResponse.json({ ok: true, version: tv });
}
