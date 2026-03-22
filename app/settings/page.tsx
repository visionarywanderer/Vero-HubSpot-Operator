"use client";

import { useState } from "react";
import { usePortal } from "@/hooks/usePortal";
import { PortalConfigForm } from "@/components/settings/PortalConfigForm";
import { AppSettingsForm } from "@/components/settings/AppSettingsForm";
import { UserManagement } from "@/components/settings/UserManagement";
import { McpConnectionsForm } from "@/components/settings/McpConnectionsForm";

const TABS = [
  { key: "portal", label: "Portal Configuration" },
  { key: "app", label: "App Settings" },
  { key: "mcp", label: "MCP Connections" },
  { key: "users", label: "Users" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function SettingsPage() {
  const { activePortal } = usePortal();
  const [tab, setTab] = useState<TabKey>("portal");

  return (
    <div className="stack">
      <h1 className="page-title">Settings</h1>
      <div className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab-item${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
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
