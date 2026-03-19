/**
 * MCP Streamable HTTP endpoint — /api/mcp
 *
 * Handles POST (JSON-RPC requests), GET (SSE stream), DELETE (close session).
 * Uses WebStandardStreamableHTTPServerTransport which works natively with
 * Next.js App Router route handlers (Web API Request/Response).
 *
 * Auth: Bearer token (MCP_API_KEY) required on all requests.
 * CORS: Configured for claude.ai / claude.com origins.
 */

import { handleStreamableHTTP } from "@/lib/mcp-embedded";

// Force Node.js runtime (not Edge) for full API compatibility
export const runtime = "nodejs";

// Disable body parsing — the MCP transport reads the body itself
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return handleStreamableHTTP(req);
}

export async function POST(req: Request): Promise<Response> {
  return handleStreamableHTTP(req);
}

export async function DELETE(req: Request): Promise<Response> {
  return handleStreamableHTTP(req);
}

export async function OPTIONS(req: Request): Promise<Response> {
  return handleStreamableHTTP(req);
}
