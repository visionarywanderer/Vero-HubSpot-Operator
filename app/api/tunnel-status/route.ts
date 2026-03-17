import { NextResponse } from "next/server";
import { getTunnelState } from "@/lib/tunnel-manager";

/**
 * GET /api/tunnel-status — Get the current tunnel state
 * Returns: { url: string | null, status: "starting" | "running" | "stopped" | "error", error?: string }
 */
export async function GET() {
  const state = getTunnelState();
  return NextResponse.json({ ok: true, ...state });
}
