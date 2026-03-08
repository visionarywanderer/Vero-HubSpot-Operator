import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { appSettingsStore } from "@/lib/app-settings-store";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const settings = await appSettingsStore.load();
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { updates?: Record<string, unknown> };
  if (!body.updates) return NextResponse.json({ ok: false, error: "updates are required" }, { status: 400 });

  const settings = await appSettingsStore.update(body.updates as never);
  return NextResponse.json({ ok: true, settings });
}
