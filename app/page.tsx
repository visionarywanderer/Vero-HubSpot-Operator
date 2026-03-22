"use client";

import { useEffect, useState } from "react";
import { usePortal } from "@/hooks/usePortal";
import { apiGet } from "@/lib/api";
import Link from "next/link";
import { ContextualPrompts } from "@/components/prompts/ContextualPrompts";

type StatsResponse = {
  ok: true;
  stats: {
    contacts: number;
    companies: number;
    openDeals: number;
    openDealValue: number;
    changesToday: number;
  };
};

type LogEntry = {
  id: string;
  description: string;
  timestamp: string;
  action: string;
};

type HealthResult = { ok: boolean; status?: string; warnings?: string[] };

const QUICK_ACTIONS = [
  { label: "Create Workflow", href: "/workflows", icon: "branch" },
  { label: "Create Property", href: "/properties", icon: "tag" },
  { label: "Install Template", href: "/templates", icon: "layout" },
  { label: "Prompt Library", href: "/prompts", icon: "sparkles" },
];

export default function DashboardPage() {
  const { activePortal, portals, loading } = usePortal();
  const [stats, setStats] = useState<StatsResponse["stats"] | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [statsError, setStatsError] = useState("");
  const [health, setHealth] = useState<"loading" | "good" | "warning" | "error">("loading");

  useEffect(() => {
    if (!activePortal?.hubId) return;
    setStatsError("");

    apiGet<StatsResponse>(`/api/stats/${activePortal.hubId}`)
      .then((resp) => setStats(resp.stats))
      .catch((err) => {
        setStats(null);
        setStatsError(err instanceof Error ? err.message : "Failed to load stats. Check portal scopes.");
      });

    apiGet<{ ok: true; logs: LogEntry[] }>(`/api/activity?portalId=${encodeURIComponent(activePortal.id)}`)
      .then((resp) => setLogs(resp.logs.slice(0, 10)))
      .catch(() => setLogs([]));

    apiGet<HealthResult>(`/api/health/deep?portalId=${encodeURIComponent(activePortal.id)}`)
      .then((r) => setHealth(r.ok && (!r.warnings || r.warnings.length === 0) ? "good" : "warning"))
      .catch(() => setHealth("error"));
  }, [activePortal?.hubId, activePortal?.id]);

  if (loading) {
    return (
      <div className="stack">
        <div className="skeleton skeleton-text" style={{ width: 200, height: 24 }} />
        <div className="card-grid">
          <div className="skeleton skeleton-stat" />
          <div className="skeleton skeleton-stat" />
          <div className="skeleton skeleton-stat" />
          <div className="skeleton skeleton-stat" />
        </div>
      </div>
    );
  }

  if (!activePortal) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
        </div>
        <p className="empty-state-title">No Portals Connected</p>
        <p className="empty-state-desc">Connect your first HubSpot portal to start managing configurations, deploying workflows, and automating your CRM.</p>
        <div className="empty-state-action">
          <Link className="btn btn-primary" href="/portals">Connect Your First Portal</Link>
        </div>
      </div>
    );
  }

  const healthColor = health === "good" ? "var(--success)" : health === "warning" ? "var(--warning)" : health === "error" ? "var(--danger)" : "var(--muted)";
  const healthLabel = health === "good" ? "Healthy" : health === "warning" ? "Warnings" : health === "error" ? "Issues" : "Checking...";

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          {activePortal.name} &middot; {activePortal.environment} &middot; Hub {activePortal.hubId}
        </p>
        <div className="accent-stripe" />
      </div>

      {statsError && (
        <div className="card" style={{ borderLeft: "3px solid var(--danger)", color: "var(--danger)", fontSize: 13 }}>
          {statsError}
        </div>
      )}

      {/* Stats + Health */}
      <div className="card-grid">
        <div className="card"><h3>Contacts</h3><div style={{ fontSize: 24, fontWeight: 600 }}>{stats?.contacts ?? "—"}</div></div>
        <div className="card"><h3>Companies</h3><div style={{ fontSize: 24, fontWeight: 600 }}>{stats?.companies ?? "—"}</div></div>
        <div className="card">
          <h3>Open Deals</h3>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{stats?.openDeals ?? "—"}</div>
          {stats?.openDealValue ? <div style={{ fontSize: 12, color: "var(--muted)" }}>${stats.openDealValue.toLocaleString()}</div> : null}
        </div>
        <div className="card">
          <h3>Portal Health</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: healthColor, display: "inline-block" }} />
            <span style={{ fontSize: 18, fontWeight: 600, color: healthColor }}>{healthLabel}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{stats?.changesToday ?? 0} changes today</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card-grid">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href} className="card card-interactive" style={{ textAlign: "center", padding: "20px 16px", textDecoration: "none" }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{action.label}</div>
          </Link>
        ))}
      </div>

      {/* Quick Prompts */}
      <div className="card stack">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Quick Prompts</h3>
          <Link href="/prompts" className="btn btn-ghost" style={{ fontSize: 12 }}>View All 53</Link>
        </div>
        <ContextualPrompts categories={["audit", "template", "meeting"]} />
      </div>

      <div className="card-grid two">
        {/* Recent Activity */}
        <div className="card stack">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Recent Activity</h3>
            <Link href="/activity" className="btn btn-ghost" style={{ fontSize: 12 }}>View All</Link>
          </div>
          {logs.length === 0 ? (
            <p className="page-subtitle">No recent activity.</p>
          ) : (
            <table className="table">
              <thead><tr><th>Action</th><th>Description</th><th>Time</th></tr></thead>
              <tbody>
                {logs.map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ fontSize: 12 }}>{entry.action}</td>
                    <td style={{ fontSize: 12 }}>{entry.description}</td>
                    <td style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>{new Date(entry.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Portal Info */}
        <div className="card stack">
          <h3>Portal Info</h3>
          <div className="stack" style={{ gap: 8 }}>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>Environment:</span>{" "}
              <span style={{ fontWeight: 500 }}>{activePortal.environment}</span>
            </div>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>Scopes:</span>{" "}
              <span style={{ fontWeight: 500 }}>{activePortal.scopes.length} granted</span>
            </div>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>Portals:</span>{" "}
              <span style={{ fontWeight: 500 }}>{portals.length} connected</span>
            </div>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>Validated:</span>{" "}
              <span style={{ fontWeight: 500 }}>{activePortal.lastValidated ? new Date(activePortal.lastValidated).toLocaleDateString() : "—"}</span>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <Link href="/settings" className="btn btn-ghost" style={{ fontSize: 12 }}>Portal Settings</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
