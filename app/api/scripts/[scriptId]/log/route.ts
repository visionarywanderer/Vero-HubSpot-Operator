import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { scriptEngine } from "@/lib/script-engine";

export async function GET(_req: Request, context: any) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const log = await scriptEngine.getLog(params.scriptId);
  return NextResponse.json({ ok: true, log });
}
