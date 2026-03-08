import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { promptLibrary, type PromptEntry } from "@/lib/prompt-library";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const category = url.searchParams.get("category") ?? undefined;
  const query = url.searchParams.get("query") ?? undefined;

  if (query) {
    return NextResponse.json({ ok: true, prompts: promptLibrary.search(query) });
  }

  return NextResponse.json({ ok: true, prompts: promptLibrary.list(category) });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { entry?: PromptEntry };
  if (!body.entry) {
    return NextResponse.json({ ok: false, error: "entry is required" }, { status: 400 });
  }

  promptLibrary.add(body.entry);
  return NextResponse.json({ ok: true });
}
