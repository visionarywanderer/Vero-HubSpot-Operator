import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { authManager } from "@/lib/auth-manager";
import {
  getActivePortalId,
  setActivePortalId,
  clearActivePortal,
} from "@/lib/active-portal";

// ---------------------------------------------------------------------------
// GET /api/active-portal — return current active portal info (no raw IDs)
// ---------------------------------------------------------------------------
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const activeId = getActivePortalId();
  if (!activeId) {
    return NextResponse.json({
      ok: true,
      activePortal: null,
      message: "No active portal set. Call set_active_portal to choose one.",
    });
  }

  const portals = authManager.listPortals();
  const portal = portals.find((p) => p.id === activeId);

  if (!portal) {
    // Stale reference — portal was removed; clean up
    clearActivePortal();
    return NextResponse.json({
      ok: true,
      activePortal: null,
      message: "Previously active portal was disconnected; selection cleared.",
    });
  }

  return NextResponse.json({
    ok: true,
    activePortal: {
      name: portal.name,
      environment: portal.environment,
      scopes: portal.scopes,
      capabilities: portal.capabilities,
      lastValidated: portal.lastValidated,
    },
  });
}

// ---------------------------------------------------------------------------
// POST /api/active-portal — set active portal by name (fuzzy) or exact id
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    portalName?: string;
    portalId?: string;
  };

  const portals = authManager.listPortals();
  if (portals.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No portals connected. Add a portal first." },
      { status: 404 }
    );
  }

  let match = null;

  if (body.portalId) {
    match = portals.find((p) => p.id === body.portalId);
  } else if (body.portalName) {
    const needle = body.portalName.toLowerCase();
    // Exact match first, then partial
    match =
      portals.find((p) => p.name.toLowerCase() === needle) ??
      portals.find((p) => p.name.toLowerCase().includes(needle));
  } else {
    return NextResponse.json(
      { ok: false, error: "Provide portalName or portalId" },
      { status: 400 }
    );
  }

  if (!match) {
    const names = portals.map((p) => `"${p.name}"`).join(", ");
    return NextResponse.json(
      {
        ok: false,
        error: `Portal not found. Available portals: ${names}`,
      },
      { status: 404 }
    );
  }

  setActivePortalId(match.id);

  return NextResponse.json({
    ok: true,
    activePortal: {
      name: match.name,
      environment: match.environment,
      scopes: match.scopes,
      lastValidated: match.lastValidated,
    },
    message: `Active portal set to "${match.name}" (${match.environment})`,
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/active-portal — clear active portal selection
// ---------------------------------------------------------------------------
export async function DELETE() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  clearActivePortal();
  return NextResponse.json({ ok: true, message: "Active portal cleared." });
}
