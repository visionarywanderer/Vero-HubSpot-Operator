/**
 * Embedded MCP server for the Next.js app.
 *
 * Uses WebStandardStreamableHTTPServerTransport which works natively with
 * Web API Request/Response — perfect for Next.js App Router route handlers.
 *
 * Tool handlers call the app's own API routes via internal localhost fetch,
 * reusing all existing auth, validation, and business logic.
 *
 * Security: MCP endpoints require Bearer token auth (MCP_API_KEY).
 * No secrets are exposed in tool results (PII redaction applied).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerTools, type ApiFn } from "./mcp-tools";

// ---------------------------------------------------------------------------
// Session store — maps sessionId → { transport, server }
// ---------------------------------------------------------------------------

interface McpSession {
  transport: WebStandardStreamableHTTPServerTransport;
  server: McpServer;
  createdAt: number;
}

const sessions = new Map<string, McpSession>();

// Clean up stale sessions every 10 minutes (max age: 30 min)
const SESSION_MAX_AGE_MS = 30 * 60 * 1000;

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    Array.from(sessions.entries()).forEach(([sid, session]) => {
      if (now - session.createdAt > SESSION_MAX_AGE_MS) {
        try { session.transport.close(); } catch {} // intentional: transport may already be closed
        sessions.delete(sid);
      }
    });
  }, 10 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Internal API caller — fetches the app's own routes via localhost
// ---------------------------------------------------------------------------

function getBaseUrl(): string {
  const port = process.env.PORT || "3000";
  return `http://localhost:${port}`;
}

function createApiFn(): ApiFn {
  const baseUrl = getBaseUrl();
  const apiKey = process.env.MCP_API_KEY || "";

  return async function api<T = unknown>(opts: {
    method?: string;
    path: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
  }): Promise<T> {
    const url = new URL(opts.path, baseUrl);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== null && v !== "") {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const method = opts.method || "GET";
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    };
    let reqBody: string | undefined;
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      reqBody = JSON.stringify(opts.body);
    }

    const res = await fetch(url.toString(), { method, headers, body: reqBody });
    const text = await res.text();

    if (!res.ok) {
      let detail: string;
      try {
        const parsed = JSON.parse(text);
        detail = parsed.error || parsed.message || text;
      } catch {
        detail = text;
      }
      throw new Error(`API ${method} ${opts.path} returned ${res.status}: ${detail}`);
    }

    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  };
}

// ---------------------------------------------------------------------------
// Factory: create a fresh MCP server instance with tools registered
// ---------------------------------------------------------------------------

function getVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require("../package.json");
    return pkg.version || "1.0.0";
  } catch {
    return "1.0.0";
  }
}

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "hubspot-operator",
    version: getVersion(),
  });
  registerTools(server, createApiFn());
  return server;
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function authenticateRequest(req: Request): boolean {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) return false;

  // 1. Bearer token in Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ") && authHeader.slice(7) === apiKey) {
    return true;
  }

  // 2. API key as URL query parameter (?key=...) — for claude.ai connectors
  //    which don't support custom headers
  try {
    const url = new URL(req.url);
    const keyParam = url.searchParams.get("key");
    if (keyParam && keyParam === apiKey) return true;
  } catch {} // intentional: URL parsing failure means no key param

  return false;
}

// ---------------------------------------------------------------------------
// CORS helper
// ---------------------------------------------------------------------------

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
  };

  if (origin.includes("claude.ai") || origin.includes("claude.com") || origin.includes("anthropic.com")) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  } else if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }

  return headers;
}

// ---------------------------------------------------------------------------
// Streamable HTTP handler — POST /api/mcp, GET /api/mcp, DELETE /api/mcp
//
// Each session gets its own transport + McpServer.
// On initialize request: create transport → connect server → handle request.
// On subsequent requests: look up session by Mcp-Session-Id header → handle.
// ---------------------------------------------------------------------------

export async function handleStreamableHTTP(req: Request): Promise<Response> {
  const cors = corsHeaders(req);

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  // Auth check
  if (!authenticateRequest(req)) {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null }),
      { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const sessionId = req.headers.get("mcp-session-id");

  // Existing session — delegate to its transport
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    const response = await session.transport.handleRequest(req);
    // Merge CORS headers into the response
    return addCorsHeaders(response, cors);
  }

  // New session — POST without session ID starts a new one
  if (req.method === "POST" && !sessionId) {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (sid: string) => {
        sessions.set(sid, { transport, server: mcpServer, createdAt: Date.now() });
      },
      onsessionclosed: (sid: string) => {
        sessions.delete(sid);
      },
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) sessions.delete(sid);
    };

    const mcpServer = createMcpServer();
    await mcpServer.connect(transport);

    const response = await transport.handleRequest(req);
    return addCorsHeaders(response, cors);
  }

  // Invalid request
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "No valid session. Send POST with initialize request first." }, id: null }),
    { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
  );
}

// ---------------------------------------------------------------------------
// Health endpoint
// ---------------------------------------------------------------------------

export function handleMcpHealth(): Response {
  return new Response(
    JSON.stringify({
      status: "ok",
      server: "hubspot-operator-mcp",
      version: getVersion(),
      mode: "embedded",
      activeSessions: sessions.size,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

// ---------------------------------------------------------------------------
// Utility: merge CORS headers into an existing Response
// ---------------------------------------------------------------------------

function addCorsHeaders(response: Response, cors: Record<string, string>): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) {
    if (!newHeaders.has(key)) {
      newHeaders.set(key, value);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
