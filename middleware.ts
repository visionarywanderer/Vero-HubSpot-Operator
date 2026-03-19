import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PREFIXES = ["/login", "/api/auth", "/api/health", "/api/portals/callback", "/_next"];

// MCP protocol endpoint — handles its own Bearer token auth
const MCP_ENDPOINT = "/api/mcp";

function isMutation(method: string): boolean {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

function isValidOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return NextResponse.next();
  }

  // MCP protocol endpoint — exactly /api/mcp (not /api/mcp-keys, /api/mcp-oauth, etc.)
  // The route handler does its own Bearer token auth check
  if (path === MCP_ENDPOINT) {
    return NextResponse.next();
  }

  // --- API key authentication (for MCP server / external clients) ---
  // Accepts: Authorization: Bearer <MCP_API_KEY>
  const mcpApiKey = process.env.MCP_API_KEY;
  if (mcpApiKey && path.startsWith("/api/")) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ") && authHeader.slice(7) === mcpApiKey) {
      // Valid API key — skip session check and CSRF (MCP is a trusted server)
      return NextResponse.next();
    }
  }

  // --- Session authentication (for browser / UI users) ---
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    if (path.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Session expired. Please sign in again." },
        { status: 401 }
      );
    }

    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  if (path.startsWith("/api/") && isMutation(req.method) && !isValidOrigin(req)) {
    return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|icons|logo).*)"]
};
