import { NextResponse } from "next/server";
import { validateConfig } from "@/lib/config-executor";
import type { TemplateResources } from "@/lib/template-types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { resources: TemplateResources };

    if (!body.resources) {
      return NextResponse.json(
        { error: "resources object is required" },
        { status: 400 }
      );
    }

    const result = validateConfig(body.resources);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Validation failed" },
      { status: 400 }
    );
  }
}
