import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, portal: null });
}

export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Server-side active portal is deprecated. Use client-side portal selection." },
    { status: 410 }
  );
}
