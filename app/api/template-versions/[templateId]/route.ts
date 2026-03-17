import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { listTemplateVersions } from "@/lib/template-versioning";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { templateId } = await params;
  const versions = listTemplateVersions(templateId);
  return NextResponse.json({ ok: true, versions });
}
