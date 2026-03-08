import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authManager } from "@/lib/auth-manager";
import { changeLogger } from "@/lib/change-logger";
import { hubSpotClient } from "@/lib/api-client";

function totalFrom(data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  const payload = data as { total?: number };
  return typeof payload.total === "number" ? payload.total : 0;
}

export async function GET(_req: Request, context: any) {
  const params = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const stats = await authManager.withPortal(params.hubId, async () => {
      await authManager.ensureValidatedForSession(params.hubId);

      const [contactsResp, companiesResp, openDealsResp, valueResp] = await Promise.all([
        hubSpotClient.post("/crm/v3/objects/contacts/search", { filterGroups: [], limit: 1 }).catch(() => ({ data: {} })),
        hubSpotClient.post("/crm/v3/objects/companies/search", { filterGroups: [], limit: 1 }).catch(() => ({ data: {} })),
        hubSpotClient.post("/crm/v3/objects/deals/search", {
          filterGroups: [{ filters: [{ propertyName: "dealstage", operator: "NOT_IN", values: ["closedwon", "closedlost"] }] }],
          properties: ["amount"],
          limit: 1
        }).catch(() => ({ data: {} })),
        hubSpotClient.post("/crm/v3/objects/deals/search", {
          filterGroups: [{ filters: [{ propertyName: "dealstage", operator: "NOT_IN", values: ["closedwon", "closedlost"] }] }],
          properties: ["amount"],
          limit: 100
        }).catch(() => ({ data: { results: [] } }))
      ]);

      const totalPipelineValue = ((valueResp.data as { results?: Array<{ properties?: { amount?: string } }> }).results || []).reduce(
        (sum, deal) => sum + (Number(deal.properties?.amount || 0) || 0),
        0
      );

      const today = new Date().toISOString().slice(0, 10);
      const summary = await changeLogger.getSummary(params.hubId, {
        dateFrom: `${today}T00:00:00.000Z`,
        dateTo: `${today}T23:59:59.999Z`
      });

      return {
        contacts: totalFrom(contactsResp.data),
        companies: totalFrom(companiesResp.data),
        openDeals: totalFrom(openDealsResp.data),
        openDealValue: totalPipelineValue,
        changesToday: summary.totalChanges
      };
    });

    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch stats";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
