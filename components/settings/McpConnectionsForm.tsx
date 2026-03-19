"use client";

import { useEffect, useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface McpConnectionState {
  connected: boolean;
  client: string;
  connectedAt: string | null;
  disconnectedAt: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function McpConnectionsForm() {
  const [status, setStatus] = useState<McpConnectionState>({
    connected: false,
    client: "",
    connectedAt: null,
    disconnectedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/mcp-status");
      const data = await res.json();
      setStatus(data);
    } catch {} // intentional: status poll failure is silent; UI retains last known state
  }, []);

  useEffect(() => {
    fetchStatus().then(() => setLoading(false));
  }, [fetchStatus]);

  // Poll status every 5s
  useEffect(() => {
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/mcp-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connected: false, client: "claude-desktop" }),
      });
      await fetchStatus();
    } catch {} // intentional: disconnect POST failure is silent; UI disconnecting state resets below
    setDisconnecting(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const configSnippet = JSON.stringify({
    mcpServers: {
      "hubspot-operator": {
        command: "/opt/homebrew/bin/node",
        args: [
          "/Users/pietro/Documents/Vero HubSpot Operator/node_modules/.bin/tsx",
          "/Users/pietro/Documents/Vero HubSpot Operator/mcp-server.ts",
        ],
        cwd: "/Users/pietro/Documents/Vero HubSpot Operator",
      },
    },
  }, null, 2);

  const configPath = "~/Library/Application Support/Claude/claude_desktop_config.json";

  if (loading) return <div className="skeleton" style={{ height: 200 }} />;

  return (
    <div className="card stack" style={{ gap: 20 }}>
      <div>
        <h3 style={{ margin: 0 }}>MCP Connection</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "4px 0 0" }}>
          Claude Desktop connects to HubSpot Operator via local STDIO. No tunnels, no API keys.
        </p>
      </div>

      {/* ── Connection Status ──────────────────────────────────────────── */}
      <div style={{
        background: status.connected ? "#e8f5e9" : "var(--bg-secondary, #f5f5f5)",
        padding: "16px 20px",
        borderRadius: 8,
        fontSize: 13,
        border: `1px solid ${status.connected ? "#66bb6a" : "var(--border, #e0e0e0)"}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{status.connected ? "🟢" : "⚪"}</span>
            <div>
              <div style={{ fontWeight: 600 }}>
                {status.connected ? "Claude Desktop Connected" : "Not Connected"}
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 2 }}>
                {status.connected && status.connectedAt
                  ? `Connected since ${new Date(status.connectedAt).toLocaleString()}`
                  : "Claude Desktop will connect automatically when it starts"}
              </div>
            </div>
          </div>
          {status.connected && (
            <button
              className="btn"
              style={{
                background: "#ef5350",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                opacity: disconnecting ? 0.6 : 1,
              }}
              onClick={disconnect}
              disabled={disconnecting}
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </button>
          )}
        </div>
      </div>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
        <strong style={{ color: "var(--text-primary)" }}>How it works:</strong>
        <ol style={{ margin: "8px 0 0", paddingLeft: 20 }}>
          <li>Claude Desktop reads its config and launches the MCP server as a subprocess</li>
          <li>Communication happens over STDIO (stdin/stdout) — no network, no ports</li>
          <li>Claude gets access to all HubSpot Operator tools (properties, pipelines, records, etc.)</li>
          <li>Restart Claude Desktop to pick up config changes</li>
        </ol>
      </div>

      {/* ── Config File ────────────────────────────────────────────────── */}
      <div style={{
        border: "1px solid var(--border, #e0e0e0)",
        borderRadius: 8,
        padding: 16,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Claude Desktop Config</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
          <code>{configPath}</code>
        </div>

        <div style={{ position: "relative" }}>
          <pre style={{
            background: "#1a1a1a",
            color: "#e0e0e0",
            padding: 16,
            borderRadius: 6,
            fontSize: 12,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            margin: 0,
          }}>
            {configSnippet}
          </pre>
          <button
            className="btn btn-ghost"
            style={{ position: "absolute", top: 8, right: 8, fontSize: 11, padding: "4px 10px", color: "#aaa", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4 }}
            onClick={() => copyToClipboard(configSnippet, "config")}
          >
            {copied === "config" ? "Copied!" : "Copy"}
          </button>
        </div>

        <div style={{
          marginTop: 12,
          padding: "10px 14px",
          background: "#e3f2fd",
          borderRadius: 6,
          fontSize: 12,
          color: "#1565c0",
          border: "1px solid #90caf9",
        }}>
          This config is already installed. Restart Claude Desktop to connect.
        </div>
      </div>

      {/* ── Available Tools ────────────────────────────────────────────── */}
      <details>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
          Available MCP Tools ({toolList.length})
        </summary>
        <div style={{
          marginTop: 8,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 6,
        }}>
          {toolList.map((tool) => (
            <div key={tool.name} style={{
              padding: "8px 12px",
              background: "var(--bg-secondary, #f5f5f5)",
              borderRadius: 6,
              fontSize: 12,
            }}>
              <code style={{ fontWeight: 600, color: "var(--primary, #2563eb)" }}>{tool.name}</code>
              <div style={{ color: "var(--text-secondary)", marginTop: 2, fontSize: 11 }}>{tool.desc}</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool list (matches mcp-server.ts registrations)
// ---------------------------------------------------------------------------

const toolList = [
  { name: "list_portals", desc: "List connected HubSpot portals" },
  { name: "portal_capabilities", desc: "Get portal scopes & capabilities" },
  { name: "list_properties", desc: "List properties for an object type" },
  { name: "create_property", desc: "Create a custom property" },
  { name: "update_property", desc: "Update an existing property" },
  { name: "delete_property", desc: "Delete/archive a property" },
  { name: "audit_properties", desc: "Audit properties for issues" },
  { name: "list_pipelines", desc: "List deal/ticket pipelines" },
  { name: "create_pipeline", desc: "Create a pipeline with stages" },
  { name: "audit_pipelines", desc: "Audit pipelines for issues" },
  { name: "get_record", desc: "Get a CRM record by ID" },
  { name: "search_records", desc: "Search CRM records with filters" },
  { name: "create_record", desc: "Create a new CRM record" },
  { name: "update_record", desc: "Update a CRM record" },
  { name: "batch_upsert_records", desc: "Batch create/update records" },
  { name: "list_lists", desc: "List all CRM lists" },
  { name: "create_list", desc: "Create a new CRM list" },
  { name: "list_workflows", desc: "List automation workflows" },
  { name: "deploy_workflow", desc: "Deploy a new workflow" },
  { name: "validate_config", desc: "Validate a config template" },
  { name: "execute_config", desc: "Execute a config template" },
  { name: "install_template", desc: "Install a saved template" },
  { name: "extract_portal_config", desc: "Extract portal config as template" },
  { name: "clone_portal", desc: "Clone config between portals" },
  { name: "activity_log", desc: "Get activity/change log" },
  { name: "create_association", desc: "Associate two CRM records" },
  { name: "batch_create_associations", desc: "Batch create associations" },
];
