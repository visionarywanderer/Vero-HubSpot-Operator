import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authManager } from "@/lib/auth-manager";
import { mcpConnector } from "@/lib/mcp-connector";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as { portalId?: string; toolName?: string; params?: object };
    if (!body.portalId || !body.toolName) {
      return NextResponse.json({ ok: false, error: "portalId and toolName are required" }, { status: 400 });
    }

    const result = await authManager.withPortal(body.portalId, async () => {
      await mcpConnector.connectWithAuthManager();
      return mcpConnector.callTool(body.toolName!, body.params ?? {});
    });

    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ ok: false, error: "MCP tool call failed" }, { status: 500 });
  }
}
