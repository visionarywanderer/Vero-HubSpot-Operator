/**
 * Tunnel Manager
 *
 * Automatically starts a public HTTPS tunnel when the MCP HTTP server starts.
 * Tries cloudflared first (best compatibility), falls back to localtunnel.
 *
 * The tunnel URL is saved to data/tunnel-state.json so the Next.js frontend
 * can read and display it in Settings.
 */

import { spawn, ChildProcess, execSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import path from "path";

const TUNNEL_STATE_PATH = path.join(process.cwd(), "data", "tunnel-state.json");

export interface TunnelState {
  url: string | null;
  status: "starting" | "running" | "stopped" | "error";
  error?: string;
  pid?: number;
  startedAt?: string;
  provider?: "cloudflared" | "localtunnel";
}

let tunnelProcess: ChildProcess | null = null;
let ltTunnel: { close: () => void } | null = null;
let currentState: TunnelState = { url: null, status: "stopped" };

function saveTunnelState(state: TunnelState): void {
  mkdirSync(path.dirname(TUNNEL_STATE_PATH), { recursive: true });
  writeFileSync(TUNNEL_STATE_PATH, JSON.stringify(state, null, 2));
  currentState = state;
}

/**
 * Read the current tunnel state from disk (used by Next.js API routes).
 */
export function getTunnelState(): TunnelState {
  try {
    if (existsSync(TUNNEL_STATE_PATH)) {
      return JSON.parse(readFileSync(TUNNEL_STATE_PATH, "utf-8"));
    }
  } catch {} // intentional: state file may not exist yet or be corrupt; default stopped state returned below
  return { url: null, status: "stopped" };
}

// ---------------------------------------------------------------------------
// Binary detection
// ---------------------------------------------------------------------------

function findBinary(name: string): string | null {
  const paths = [
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  try {
    const result = execSync(`which ${name} 2>/dev/null`, { encoding: "utf-8" }).trim();
    if (result) return result;
  } catch {}
  return null;
}

// ---------------------------------------------------------------------------
// Cloudflare Quick Tunnel
// ---------------------------------------------------------------------------

function startCloudflared(localPort: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const bin = findBinary("cloudflared");
    if (!bin) {
      reject(new Error("cloudflared not found"));
      return;
    }

    console.error(`[Tunnel] Starting cloudflared...`);
    saveTunnelState({ url: null, status: "starting", provider: "cloudflared" });

    const proc = spawn(bin, [
      "tunnel",
      "--url", `http://localhost:${localPort}`,
      "--no-autoupdate",
    ], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    tunnelProcess = proc;
    let resolved = false;
    let output = "";

    // Match the URL from cloudflared output — may appear in a box or plain text
    const urlRegex = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

    const handleData = (data: Buffer) => {
      const text = data.toString();
      output += text;
      const match = output.match(urlRegex);
      if (match && !resolved) {
        resolved = true;
        const url = match[0];
        saveTunnelState({
          url,
          status: "running",
          pid: proc.pid,
          startedAt: new Date().toISOString(),
          provider: "cloudflared",
        });
        resolve(url);
      }
    };

    proc.stdout?.on("data", handleData);
    proc.stderr?.on("data", handleData);

    proc.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`cloudflared error: ${err.message}`));
      }
    });

    proc.on("exit", (code) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`cloudflared exited with code ${code}`));
      } else {
        saveTunnelState({ url: null, status: "stopped" });
      }
      tunnelProcess = null;
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        // Kill the stuck process
        try { proc.kill("SIGTERM"); } catch {}
        tunnelProcess = null;
        reject(new Error("cloudflared startup timed out (30s)"));
      }
    }, 30000);
  });
}

// ---------------------------------------------------------------------------
// localtunnel (npm package — no account needed, fallback)
// ---------------------------------------------------------------------------

async function startLocaltunnel(localPort: number): Promise<string> {
  console.error(`[Tunnel] Starting localtunnel...`);
  saveTunnelState({ url: null, status: "starting", provider: "localtunnel" });

  const localtunnel = (await import("localtunnel")).default;
  const tunnel = await localtunnel({ port: localPort });

  ltTunnel = tunnel;

  const url = tunnel.url;
  saveTunnelState({
    url,
    status: "running",
    startedAt: new Date().toISOString(),
    provider: "localtunnel",
  });

  tunnel.on("close", () => {
    saveTunnelState({ url: null, status: "stopped" });
    ltTunnel = null;
  });

  tunnel.on("error", (err: Error) => {
    console.error(`[Tunnel] localtunnel error: ${err.message}`);
  });

  return url;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start a tunnel pointing to the given local port.
 * Tries cloudflared first (best HTTPS support), falls back to localtunnel.
 */
export async function startTunnel(localPort: number): Promise<string> {
  // Try cloudflared first (proper HTTPS, no interstitial)
  try {
    return await startCloudflared(localPort);
  } catch (err) {
    console.error(`[Tunnel] cloudflared failed: ${(err as Error).message}`);
    stopTunnel();
  }

  // Fall back to localtunnel
  try {
    return await startLocaltunnel(localPort);
  } catch (err) {
    console.error(`[Tunnel] localtunnel failed: ${(err as Error).message}`);
    stopTunnel();
    saveTunnelState({ url: null, status: "error", error: "All tunnel providers failed" });
    throw new Error("All tunnel providers failed");
  }
}

/**
 * Stop the running tunnel.
 */
export function stopTunnel(): void {
  if (ltTunnel) {
    try { ltTunnel.close(); } catch {}
    ltTunnel = null;
  }
  if (tunnelProcess) {
    try { tunnelProcess.kill("SIGTERM"); } catch {}
    tunnelProcess = null;
  }
  saveTunnelState({ url: null, status: "stopped" });
  try {
    if (existsSync(TUNNEL_STATE_PATH)) {
      unlinkSync(TUNNEL_STATE_PATH);
    }
  } catch {}
}

/**
 * Get the current tunnel URL (in-process, for the MCP server).
 */
export function getCurrentTunnelUrl(): string | null {
  return currentState.url;
}
