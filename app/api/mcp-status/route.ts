import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const STATE_FILE = join(process.cwd(), "data", "mcp-connection-state.json");

interface McpConnectionState {
  connected: boolean;
  client: string;
  connectedAt: string | null;
  disconnectedAt: string | null;
}

function getState(): McpConnectionState {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {}
  return { connected: false, client: "", connectedAt: null, disconnectedAt: null };
}

function setState(state: McpConnectionState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// GET /api/mcp-status — get current MCP connection status
export async function GET() {
  return NextResponse.json(getState());
}

// POST /api/mcp-status — update connection state (connect/disconnect)
export async function POST(req: Request) {
  const body = await req.json();
  const { connected, client } = body;

  const state: McpConnectionState = {
    connected: !!connected,
    client: client || "claude-desktop",
    connectedAt: connected ? new Date().toISOString() : getState().connectedAt,
    disconnectedAt: !connected ? new Date().toISOString() : null,
  };
  setState(state);

  return NextResponse.json({ success: true, ...state });
}
