import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { changeLogger } from "@/lib/change-logger";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { portalId?: string; format?: "json" | "csv" };
  if (!body.portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

  const filePath = await changeLogger.exportLog(body.portalId, body.format ?? "csv");
  return NextResponse.json({ ok: true, filePath });
}
