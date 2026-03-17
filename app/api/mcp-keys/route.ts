import { NextRequest, NextResponse } from "next/server";
import { mcpKeysStore } from "@/lib/mcp-keys-store";

/**
 * GET /api/mcp-keys — List all MCP API keys (without secrets)
 */
export async function GET() {
  const keys = mcpKeysStore.list();
  return NextResponse.json({ ok: true, keys });
}

/**
 * POST /api/mcp-keys — Create a new MCP API key
 * Body: { label: string, platform: "claude" | "chatgpt" | "other" }
 * Returns the full key ONCE in the response.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const label = body.label?.trim();
  const platform = body.platform || "other";

  if (!label) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  if (!["claude", "chatgpt", "other"].includes(platform)) {
    return NextResponse.json({ error: "Platform must be claude, chatgpt, or other" }, { status: 400 });
  }

  const key = mcpKeysStore.create(label, platform);
  return NextResponse.json({ ok: true, key });
}

/**
 * DELETE /api/mcp-keys — Delete a key
 * Body: { id: string }
 */
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: "Key id is required" }, { status: 400 });
  }

  mcpKeysStore.delete(body.id);
  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/mcp-keys — Update or revoke a key
 * Body: { id: string, action: "revoke" | "activate" | "update", label?: string, platform?: string }
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: "Key id is required" }, { status: 400 });
  }

  if (body.action === "revoke") {
    mcpKeysStore.revoke(body.id);
  } else if (body.action === "update") {
    mcpKeysStore.update(body.id, {
      label: body.label,
      platform: body.platform,
    });
  }

  const keys = mcpKeysStore.list();
  return NextResponse.json({ ok: true, keys });
}
