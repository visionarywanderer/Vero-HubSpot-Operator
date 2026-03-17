import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { changeLogger } from "@/lib/change-logger";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const portalId = url.searchParams.get("portalId");
  if (!portalId) {
    return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });
  }

  const logs = await changeLogger.getLog(portalId, {
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    action: url.searchParams.get("action") ?? undefined,
    objectType: url.searchParams.get("objectType") ?? undefined,
    status: url.searchParams.get("status") ?? undefined
  });

  return NextResponse.json({ ok: true, logs });
}
