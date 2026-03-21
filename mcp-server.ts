#!/usr/bin/env npx tsx
/**
 * HubSpot Operator MCP Server (HTTP Proxy Mode)
 *
 * Proxies MCP tool calls to the Railway-deployed HubSpot Operator app
 * via its REST API. No direct library imports — all business logic runs
 * on the Railway server.
 *
 * Required env vars (loaded from .env.local):
 *   APP_BASE_URL  — e.g. https://vero-hubspot-operator-production.up.railway.app
 *   MCP_API_KEY   — Bearer token accepted by the app's middleware
 *
 * Transport modes:
 *   STDIO  (default)  — for Claude Code / local MCP clients
 *     npx tsx mcp-server.ts
 *
 *   HTTP+SSE           — for ChatGPT / remote MCP clients
 *     npx tsx mcp-server.ts --http [--port 8080]
 *
 * Claude Code config (.mcp.json):
 *   {
 *     "mcpServers": {
 *       "hubspot-operator": {
 *         "command": "npx",
 *         "args": ["tsx", "/path/to/mcp-server.ts"]
 *       }
 *     }
 *   }
 */

// Load .env.local if present (tsx doesn't auto-load like Next.js does)
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Derive the directory this script lives in (works regardless of cwd)
const __scriptDir = (() => {
  try { return dirname(fileURLToPath(import.meta.url)); } catch { /* fallback below */ }
  try { if (import.meta.dirname) return import.meta.dirname; } catch { /* fallback below */ }
  return process.cwd();
})();

// Read version from package.json (single source of truth)
const APP_VERSION = (() => {
  for (const dir of [__scriptDir, process.cwd()]) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      if (pkg.version) return pkg.version as string;
    } catch { /* try next */ }
  }
  return "0.0.0";
})();

const envCandidates = [
  join(__scriptDir, ".env.local"),
  join(process.cwd(), ".env.local"),
];
for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
    break; // Only load the first found .env.local
  }
}

// Verify critical env vars are present
const APP_BASE_URL = (process.env.APP_BASE_URL || "").replace(/\/+$/, "");
const MCP_API_KEY = process.env.MCP_API_KEY || "";

if (!APP_BASE_URL) {
  process.stderr.write("[mcp-server] FATAL: APP_BASE_URL not set. Add it to .env.local (e.g. https://vero-hubspot-operator-production.up.railway.app)\n");
  process.exit(1);
}
if (!MCP_API_KEY) {
  process.stderr.write("[mcp-server] FATAL: MCP_API_KEY not set. Add it to .env.local\n");
  process.exit(1);
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { registerTools, type ApiFn } from "./lib/mcp-tools";

// ---------------------------------------------------------------------------
// HTTP API helper — proxies tool calls to the remote app
// ---------------------------------------------------------------------------

function createApiProxy(): ApiFn {
  return async function api<T = unknown>(opts: {
    method?: string;
    path: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
  }): Promise<T> {
    const url = new URL(opts.path, APP_BASE_URL);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== null && v !== "") {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const method = opts.method || "GET";
    const headers: Record<string, string> = {
      Authorization: `Bearer ${MCP_API_KEY}`,
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

const apiProxy = createApiProxy();

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "hubspot-operator",
  version: APP_VERSION,
});

// Register tools on the global server instance (used in stdio mode)
registerTools(server, apiProxy);

// ---------------------------------------------------------------------------
// Transport: parse CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const httpMode = args.includes("--http");
const portIdx = args.indexOf("--port");
const HTTP_PORT = portIdx !== -1 ? Number(args[portIdx + 1]) : Number(process.env.MCP_PORT) || 8808;

// ---------------------------------------------------------------------------
// CORS helper
// ---------------------------------------------------------------------------

function setCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers["origin"] || "";
  if (origin.includes("claude.ai") || origin.includes("claude.com")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

// ---------------------------------------------------------------------------
// Start — STDIO or HTTP+SSE
// ---------------------------------------------------------------------------

async function main() {
  process.stderr.write(`[mcp-server] Proxying to ${APP_BASE_URL}\n`);

  if (!httpMode) {
    // -- STDIO mode (Claude Code, local clients) --
    const transport = new StdioServerTransport();
    await server.connect(transport);
    return;
  }

  // -- HTTP mode (ChatGPT, remote clients) --
  const transports: Record<string, SSEServerTransport | StreamableHTTPServerTransport> = {};

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    setCorsHeaders(req, res);

    console.error(`[HTTP] ${req.method} ${pathname}${url.search || ""}`);

    // Preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        server: "hubspot-operator-mcp",
        version: APP_VERSION,
        mode: "proxy",
        target: APP_BASE_URL,
        activeSessions: Object.keys(transports).length,
      }));
      return;
    }

    // -- Streamable HTTP endpoint: /mcp --
    if (pathname === "/mcp") {
      try {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        let transport: StreamableHTTPServerTransport | undefined;

        if (sessionId && transports[sessionId]) {
          const existing = transports[sessionId];
          if (existing instanceof StreamableHTTPServerTransport) {
            transport = existing;
          } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Session uses different transport" }, id: null }));
            return;
          }
        } else if (!sessionId && req.method === "POST") {
          const body = await readBody(req);
          if (isInitializeRequest(body)) {
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              onsessioninitialized: (sid: string) => {
                transports[sid] = transport!;
              },
            });
            transport.onclose = () => {
              const sid = transport!.sessionId;
              if (sid) delete transports[sid];
            };
            const newServer = createMcpServerInstance();
            await newServer.connect(transport);
          }
          if (transport) {
            await transport.handleRequest(req, res, body);
            return;
          }
        }

        if (transport) {
          await transport.handleRequest(req, res);
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "No valid session" }, id: null }));
        }
      } catch {
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null }));
        }
      }
      return;
    }

    // -- SSE endpoint: /sse --
    if (pathname === "/sse" && req.method === "GET") {
      const transport = new SSEServerTransport("/messages", res);
      transports[transport.sessionId] = transport;
      res.on("close", () => { delete transports[transport.sessionId]; });

      const newServer = createMcpServerInstance();
      await newServer.connect(transport);
      return;
    }

    // -- SSE message endpoint: /messages --
    if (pathname === "/messages" && req.method === "POST") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId || !transports[sessionId]) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid or missing sessionId" }));
        return;
      }
      const transport = transports[sessionId];
      if (transport instanceof SSEServerTransport) {
        const body = await readBody(req);
        await transport.handlePostMessage(req, res, body);
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session uses different transport" }));
      }
      return;
    }

    // -- Root endpoint --
    if (pathname === "/" && req.method === "GET") {
      const proto = (req.headers["x-forwarded-proto"] as string) || "http";
      const host = req.headers["host"] || `localhost:${HTTP_PORT}`;
      const baseUrl = `${proto}://${host}`;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        name: "hubspot-operator-mcp",
        version: APP_VERSION,
        mode: "proxy",
        target: APP_BASE_URL,
        mcp: {
          sse: `${baseUrl}/sse`,
          streamable: `${baseUrl}/mcp`,
        },
      }));
      return;
    }

    // -- 404 --
    console.error(`[404] ${req.method} ${pathname}`);
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Not found",
      endpoints: {
        "/sse": "GET — SSE stream",
        "/mcp": "POST — Streamable HTTP",
        "/messages": "POST — SSE message endpoint",
        "/health": "GET — Health check",
      },
    }));
  });

  httpServer.listen(HTTP_PORT, () => {
    console.error(`\nHubSpot Operator MCP Server (HTTP proxy mode)`);
    console.error(`  Port:   ${HTTP_PORT}`);
    console.error(`  Target: ${APP_BASE_URL}`);
    console.error(`\n  Endpoints:`);
    console.error(`    SSE:              http://localhost:${HTTP_PORT}/sse`);
    console.error(`    Streamable HTTP:  http://localhost:${HTTP_PORT}/mcp`);
    console.error(`    Health:           http://localhost:${HTTP_PORT}/health\n`);
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.error("\nShutting down...");
    for (const sid of Object.keys(transports)) {
      try { await transports[sid].close(); } catch {} // intentional: transport may already be closed during shutdown
      delete transports[sid];
    }
    httpServer.close();
    process.exit(0);
  });
}

// ---------------------------------------------------------------------------
// Helper: read HTTP request body as JSON
// ---------------------------------------------------------------------------

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        if (!raw) { resolve(undefined); return; }
        const contentType = req.headers["content-type"] || "";
        if (contentType.includes("application/x-www-form-urlencoded")) {
          const params = new URLSearchParams(raw);
          const obj: Record<string, string> = {};
          params.forEach((v, k) => { obj[k] = v; });
          resolve(obj);
          return;
        }
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Factory: create a fresh MCP server instance (HTTP mode needs one per session)
// ---------------------------------------------------------------------------

function createMcpServerInstance(): McpServer {
  const s = new McpServer({ name: "hubspot-operator", version: APP_VERSION });
  registerTools(s, apiProxy);
  return s;
}

main().catch((err) => {
  console.error("MCP server failed:", err);
  process.exit(1);
});
