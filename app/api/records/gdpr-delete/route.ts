import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { hubSpotClient } from "@/lib/api-client";
import { changeLogger } from "@/lib/change-logger";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { contactId?: string; portalId?: string };
  if (!body.portalId || !body.contactId) {
    return NextResponse.json({ ok: false, error: "portalId and contactId are required" }, { status: 400 });
  }

  try {
    await authManager.withPortal(body.portalId, async () => {
      await hubSpotClient.post("/crm/v3/objects/contacts/gdpr-delete", {
        objectId: body.contactId,
        idProperty: "hs_object_id",
      });
    });

    await changeLogger.log({
      portalId: body.portalId,
      layer: "api",
      module: "A7",
      action: "gdpr_delete",
      objectType: "contacts",
      recordId: body.contactId!,
      description: `GDPR permanent deletion of contact ${body.contactId}`,
      status: "success",
      initiatedBy: "VeroDigital",
    });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "GDPR delete failed" }, { status: 500 });
  }
}
