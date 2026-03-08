import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authManager } from "@/lib/auth-manager";

export async function GET(_req: Request, context: any) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const valid = await authManager.validateToken(params.portalId);
    return NextResponse.json({ ok: true, valid });
  } catch {
    return NextResponse.json({ ok: false, valid: false }, { status: 200 });
  }
}
