import type { PipelineObjectType } from "@/lib/pipeline-manager";

/** Extract portalId from the request URL query string. */
export function portalFromUrl(req: Request): string | null {
  return new URL(req.url).searchParams.get("portalId");
}

/** Parse and validate a pipeline object type string. */
export function parseObjectType(value: string | null): PipelineObjectType | null {
  return value === "deals" || value === "tickets" ? value : null;
}

/** Typed context for Next.js App Router route handlers. */
export type RouteContext<T extends Record<string, string>> = {
  params: Promise<T>;
};
