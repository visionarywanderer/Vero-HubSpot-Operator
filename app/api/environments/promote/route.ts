import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/api-auth";
import { promoteEnvironment } from "@/lib/environment-manager";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    sourceEnv?: string;
    targetEnv?: string;
    dryRun?: boolean;
    options?: {
      properties?: boolean;
      pipelines?: boolean;
      workflows?: boolean;
      lists?: boolean;
      customObjects?: boolean;
      associations?: boolean;
    };
  };

  if (!body.sourceEnv || !body.targetEnv) {
    return NextResponse.json({ ok: false, error: "sourceEnv and targetEnv are required" }, { status: 400 });
  }

  try {
    const result = await promoteEnvironment(
      body.sourceEnv,
      body.targetEnv,
      body.options,
      body.dryRun !== false
    );
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Promotion failed" },
      { status: 500 }
    );
  }
}
