import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authManager } from "@/lib/auth-manager";
import { buildCapabilities } from "@/lib/hubspot-scopes";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, portals: authManager.listPortals() });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      id?: string;
      name?: string;
      hubId?: string;
      token?: string;
      environment?: "production" | "sandbox";
    };

    if (!body.id || !body.name || !body.token) {
      return NextResponse.json({ ok: false, error: "id, name, and token are required" }, { status: 400 });
    }

    await authManager.addPortal({
      id: body.id,
      name: body.name,
      hubId: body.hubId ?? "",
      token: body.token,
      scopes: [],
      capabilities: buildCapabilities([]),
      environment: body.environment ?? "production",
      createdAt: new Date().toISOString(),
      lastValidated: new Date().toISOString()
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error && error.message === "Invalid HubSpot token"
      ? "Invalid HubSpot token"
      : "Failed to add portal";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
