import { NextResponse } from "next/server";
import { validateTemplate } from "@/lib/constraint-validator";
import type { TemplateDefinition } from "@/lib/template-types";

export async function POST(request: Request) {
  try {
    const template = (await request.json()) as TemplateDefinition;
    const result = validateTemplate(template);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Validation failed" },
      { status: 400 }
    );
  }
}
