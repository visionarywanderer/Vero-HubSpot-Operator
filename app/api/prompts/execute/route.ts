import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { promptLibrary } from "@/lib/prompt-library";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { id?: string; parameters?: Record<string, string>; portalId?: string };
  if (!body.id) {
    return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  }

  if (!body.portalId) {
    return NextResponse.json({ ok: false, error: "portalId is required" }, { status: 400 });
  }

  try {
    await promptLibrary.execute(body.id, body.parameters, body.portalId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Prompt execution failed" },
      { status: 400 }
    );
  }
}
