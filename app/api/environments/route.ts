import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import {
  listEnvironments,
  registerEnvironment,
  removeEnvironment,
  type EnvironmentRole,
} from "@/lib/environment-manager";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ ok: true, environments: listEnvironments() });
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    name?: string;
    portalId?: string;
    role?: EnvironmentRole;
    label?: string;
  };

  if (!body.name || !body.portalId || !body.role) {
    return NextResponse.json({ ok: false, error: "name, portalId, and role are required" }, { status: 400 });
  }

  if (!["development", "staging", "production"].includes(body.role)) {
    return NextResponse.json({ ok: false, error: "role must be development, staging, or production" }, { status: 400 });
  }

  const env = registerEnvironment(body.name, body.portalId, body.role, body.label);
  return NextResponse.json({ ok: true, environment: env });
}

export async function DELETE(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  if (!name) return NextResponse.json({ ok: false, error: "name query param required" }, { status: 400 });

  removeEnvironment(name);
  return NextResponse.json({ ok: true });
}
