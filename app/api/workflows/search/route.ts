import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { workflowEngine } from "@/lib/workflow-engine";

/** POST /api/workflows/search — Find workflow by name (case-insensitive partial match) */
export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { name?: string; portalId?: string };
  if (!body.name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
  if (!body.portalId) return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });

  try {
    const matches = await authManager.withPortal(body.portalId, async () => {
      const all = await workflowEngine.list();
      const needle = body.name!.toLowerCase();
      return all.filter((w) => String(w.name || "").toLowerCase().includes(needle));
    });
    return NextResponse.json({ ok: true, results: matches, total: matches.length });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}
