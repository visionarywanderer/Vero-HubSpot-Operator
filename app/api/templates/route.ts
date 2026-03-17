import { NextResponse } from "next/server";
import { templateStore } from "@/lib/template-store";

export async function GET() {
  try {
    const templates = await templateStore.listTemplates();
    const packs = await templateStore.listPacks();
    return NextResponse.json({ templates, packs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list templates" },
      { status: 500 }
    );
  }
}
