import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { scriptEngine } from "@/lib/script-engine";

export async function GET(_req: Request, context: any) {
  const params = await context.params;
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const log = await scriptEngine.getLog(params.scriptId);
  return NextResponse.json({ ok: true, log });
}
