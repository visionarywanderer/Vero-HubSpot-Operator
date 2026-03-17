import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { promptLibrary } from "@/lib/prompt-library";

export async function GET(_req: Request, context: any) {
  const params = await context.params;
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const prompt = promptLibrary.get(params.id);
    return NextResponse.json({ ok: true, prompt });
  } catch {
    return NextResponse.json({ ok: false, error: "Prompt not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, context: any) {
  const params = await context.params;
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  promptLibrary.remove(params.id);
  return NextResponse.json({ ok: true });
}
