import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { hubSpotClient } from "@/lib/api-client";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const portalId = url.searchParams.get("portalId");
  if (!portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

  try {
    const owners = await authManager.withPortal(portalId, async () => {
      const response = await hubSpotClient.get("/crm/v3/owners", { limit: 500 });
      const data = response.data as { results?: Array<{ id?: string; email?: string; firstName?: string; lastName?: string; userId?: number }> };
      return (data.results || []).map((o) => ({
        id: o.id,
        email: o.email,
        firstName: o.firstName,
        lastName: o.lastName,
        name: [o.firstName, o.lastName].filter(Boolean).join(" "),
        userId: o.userId,
      }));
    });
    return NextResponse.json({ ok: true, owners });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to list owners" }, { status: 500 });
  }
}
