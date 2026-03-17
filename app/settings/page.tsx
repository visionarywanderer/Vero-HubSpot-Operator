"use client";

import { useState } from "react";
import { usePortal } from "@/hooks/usePortal";
import { PortalConfigForm } from "@/components/settings/PortalConfigForm";
import { AppSettingsForm } from "@/components/settings/AppSettingsForm";
import { UserManagement } from "@/components/settings/UserManagement";
import { McpConnectionsForm } from "@/components/settings/McpConnectionsForm";

export default function SettingsPage() {
  const { activePortal } = usePortal();
  const [tab, setTab] = useState<"portal" | "app" | "mcp" | "users">("portal");

  return (
    <div className="stack">
      <h1 className="page-title">Settings</h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={`btn ${tab === "portal" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("portal")}>Portal Configuration</button>
        <button className={`btn ${tab === "app" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("app")}>App Settings</button>
        <button className={`btn ${tab === "mcp" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("mcp")}>MCP Connections</button>
        <button className={`btn ${tab === "users" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("users")}>Users</button>
      </div>

      {tab === "portal" ? (
        activePortal ? <PortalConfigForm portalId={activePortal.id} /> : <div className="empty-state">Select an active portal.</div>
      ) : null}

      {tab === "app" ? <AppSettingsForm /> : null}
      {tab === "mcp" ? <McpConnectionsForm /> : null}
      {tab === "users" ? <UserManagement /> : null}
    </div>
  );
}
