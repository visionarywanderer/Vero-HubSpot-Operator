import { NextRequest, NextResponse } from "next/server";
import { mcpOAuthStore } from "@/lib/mcp-oauth-store";

/**
 * GET /api/mcp-oauth — List all OAuth clients (without secrets)
 */
export async function GET() {
  const clients = mcpOAuthStore.listClients();
  return NextResponse.json({ ok: true, clients });
}

/**
 * POST /api/mcp-oauth — Create a new OAuth client
 * Body: { label: string, platform: "claude_desktop" | "chatgpt" | "other" }
 * Returns the client_secret ONCE in the response.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const label = body.label?.trim();
  const platform = body.platform || "other";

  if (!label) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  if (!["claude_desktop", "chatgpt", "other"].includes(platform)) {
    return NextResponse.json({ error: "Platform must be claude_desktop, chatgpt, or other" }, { status: 400 });
  }

  const client = mcpOAuthStore.createClient(label, platform);
  return NextResponse.json({ ok: true, client });
}

/**
 * DELETE /api/mcp-oauth — Delete an OAuth client
 * Body: { id: string }
 */
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: "Client id is required" }, { status: 400 });
  }

  mcpOAuthStore.deleteClient(body.id);
  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/mcp-oauth — Revoke an OAuth client
 * Body: { id: string, action: "revoke" }
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: "Client id is required" }, { status: 400 });
  }

  if (body.action === "revoke") {
    mcpOAuthStore.revokeClient(body.id);
  }

  const clients = mcpOAuthStore.listClients();
  return NextResponse.json({ ok: true, clients });
}
