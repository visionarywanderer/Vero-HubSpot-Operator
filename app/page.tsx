"use client";

import { useEffect, useState } from "react";
import { usePortal } from "@/hooks/usePortal";
import { apiGet } from "@/lib/api";
import Link from "next/link";

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

export default function DashboardPage() {
  const { activePortal, portals, loading } = usePortal();
  const [stats, setStats] = useState<StatsResponse["stats"] | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [statsError, setStatsError] = useState("");

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
  }, [activePortal?.hubId, activePortal?.id]);

  if (loading) return <div className="card">Loading dashboard...</div>;

  if (!activePortal) {
    return (
      <div className="empty-state">
        <h1 className="page-title">No Portals Connected</h1>
        <p className="page-subtitle">Connect your first HubSpot portal to start managing configurations.</p>
        <Link className="btn btn-primary" href="/portals">Connect Your First Portal</Link>
      </div>
    );
  }

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          {activePortal.name} &middot; {activePortal.environment} &middot; Hub {activePortal.hubId}
        </p>
        <div className="accent-stripe" />
      </div>

      {/* Stats Error */}
      {statsError && (
        <div className="card" style={{ borderLeft: "3px solid var(--danger)", color: "var(--danger)", fontSize: 13 }}>
          {statsError}
        </div>
      )}

      {/* Portal Stats */}
      <div className="card-grid">
        <div className="card"><h3>Contacts</h3><div style={{ fontSize: 24, fontWeight: 600 }}>{stats?.contacts ?? "—"}</div></div>
        <div className="card"><h3>Companies</h3><div style={{ fontSize: 24, fontWeight: 600 }}>{stats?.companies ?? "—"}</div></div>
        <div className="card">
          <h3>Open Deals</h3>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{stats?.openDeals ?? "—"}</div>
          {stats?.openDealValue ? <div style={{ fontSize: 12, color: "var(--muted)" }}>${stats.openDealValue.toLocaleString()}</div> : null}
        </div>
        <div className="card"><h3>Changes Today</h3><div style={{ fontSize: 24, fontWeight: 600 }}>{stats?.changesToday ?? "—"}</div></div>
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

        {/* Quick Navigation */}
        <div className="card stack">
          <h3>Quick Navigation</h3>
          <div className="stack" style={{ gap: 6 }}>
            <Link href="/how-it-works" className="btn btn-primary" style={{ textAlign: "left" }}>How It Works — Start Here</Link>
            <Link href="/templates" className="btn btn-primary" style={{ textAlign: "left" }}>Install Templates</Link>
            <Link href="/prompt-packs" className="btn btn-primary" style={{ textAlign: "left" }}>Prompt Packs for Claude</Link>
            <Link href="/properties" className="btn btn-ghost" style={{ textAlign: "left" }}>Manage Properties</Link>
            <Link href="/workflows" className="btn btn-ghost" style={{ textAlign: "left" }}>Manage Workflows</Link>
            <Link href="/environments" className="btn btn-ghost" style={{ textAlign: "left" }}>Manage Environments</Link>
          </div>

          {/* Portal Info */}
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            <div><strong>Scopes:</strong> {activePortal.scopes.length} granted</div>
            <div><strong>Connected portals:</strong> {portals.length}</div>
            <div><strong>Last validated:</strong> {activePortal.lastValidated ? new Date(activePortal.lastValidated).toLocaleDateString() : "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
