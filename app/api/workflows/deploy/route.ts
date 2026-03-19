import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import { workflowEngine } from "@/lib/workflow-engine";
import { resolvePortalId } from "@/lib/active-portal";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    portalId?: string;
    spec?: Record<string, unknown>;
    allowPartial?: boolean;
  };

  if (!body.spec) {
    return NextResponse.json({ ok: false, error: "spec is required" }, { status: 400 });
  }

  let portalId: string;
  try { portalId = resolvePortalId(body.portalId); }
  catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "portalId required" }, { status: 400 }); }

  // allowPartial (default true): use partial-install engine so unsupported
  // actions are stripped and surfaced as manual steps instead of hard-failing.
  const allowPartial = body.allowPartial !== false;

  try {
    const deployFn = allowPartial
      ? () => workflowEngine.deployPartial(body.spec!)
      : () => workflowEngine.deploy(body.spec!);

    const result = await authManager.withPortal(portalId, deployFn);

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          errors: result.errors ?? ["Workflow deployment blocked"],
          // Surface partial-install detail even on failure (some actions may have been stripped)
          ...(result.partial ? { partial: result.partial } : {}),
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      result: {
        flowId: result.flowId,
        name: result.name,
        isEnabled: result.isEnabled,
        // Partial-install report (undefined if everything installed cleanly)
        partial: result.partial,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workflow deploy failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
