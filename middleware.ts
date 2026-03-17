import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PREFIXES = ["/login", "/api/auth", "/api/health", "/api/portals/callback", "/_next"];

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

  // Let getToken use NextAuth's default cookie name detection (based on
  // NEXTAUTH_URL protocol). No custom cookieName — this guarantees it
  // reads the same cookie that NextAuth's route handler sets.
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
