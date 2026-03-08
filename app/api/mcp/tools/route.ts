import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authManager } from "@/lib/auth-manager";
import { mcpConnector } from "@/lib/mcp-connector";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const portalId = new URL(req.url).searchParams.get("portalId");
  if (!portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

  try {
    const tools = await authManager.withPortal(portalId, async () => {
      await mcpConnector.connectWithAuthManager();
      return mcpConnector.listTools();
    });
    return NextResponse.json({ ok: true, tools });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to list MCP tools" }, { status: 500 });
  }
}
