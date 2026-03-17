import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { rollbackDeployment } from "@/lib/rollback-manager";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { dryRun?: boolean };

  try {
    const result = await rollbackDeployment(id, body.dryRun !== false);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Rollback failed" },
      { status: 500 }
    );
  }
}
