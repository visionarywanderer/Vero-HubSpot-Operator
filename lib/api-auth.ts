import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Check if the current request is authenticated via either:
 * 1. NextAuth session (browser/UI users)
 * 2. MCP_API_KEY bearer token (MCP server / external clients)
 *
 * Returns true if authenticated, false otherwise.
 */
export async function isAuthenticated(): Promise<boolean> {
  // Check API key first (cheaper than session lookup)
  const mcpApiKey = process.env.MCP_API_KEY;
  if (mcpApiKey) {
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    if (authHeader?.startsWith("Bearer ") && authHeader.slice(7) === mcpApiKey) {
      return true;
    }
  }

  // Fall back to session auth
  const session = await getServerSession(authOptions);
  return Boolean(session);
}
