import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { changeLogger } from "@/lib/change-logger";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { portalId?: string; format?: "json" | "csv" };
  if (!body.portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

  const filePath = await changeLogger.exportLog(body.portalId, body.format ?? "csv");
  return NextResponse.json({ ok: true, filePath });
}
