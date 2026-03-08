import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { portalConfigStore } from "@/lib/portal-config-store";
import { promptLibrary } from "@/lib/prompt-library";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { id?: string; portalId?: string };
  if (!body.id || !body.portalId) {
    return NextResponse.json({ ok: false, error: "id and portalId are required" }, { status: 400 });
  }

  try {
    const config = await portalConfigStore.load(body.portalId);
    const resolved = promptLibrary.resolve(body.id, config);
    return NextResponse.json({ ok: true, resolved });
  } catch {
    return NextResponse.json({ ok: false, error: "Unable to resolve prompt" }, { status: 500 });
  }
}
