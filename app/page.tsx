"use client";

import { useEffect, useState } from "react";
import { usePortal } from "@/hooks/usePortal";
import { apiGet, apiPost } from "@/lib/api";

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
  const { activePortal, loading } = usePortal();
  const [stats, setStats] = useState<StatsResponse["stats"] | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!activePortal?.hubId) return;

    apiGet<StatsResponse>(`/api/stats/${activePortal.hubId}`)
      .then((resp) => setStats(resp.stats))
      .catch(() => setStats(null));

    apiGet<{ ok: true; logs: LogEntry[] }>(`/api/activity?portalId=${encodeURIComponent(activePortal.id)}`)
      .then((resp) => setLogs(resp.logs.slice(0, 10)))
      .catch(() => setLogs([]));
  }, [activePortal?.hubId, activePortal?.id]);

  if (loading) return <div className="card">Loading dashboard...</div>;

  if (!activePortal) {
    return (
      <div className="empty-state">
        <h1 className="page-title">No Portals Connected</h1>
        <p className="page-subtitle">Connect your first portal to start operations.</p>
        <a className="btn btn-primary" href="/portals">Connect Your First Portal</a>
      </div>
    );
  }

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">At-a-glance status for {activePortal.name}</p>
        <div className="accent-stripe" />
      </div>

      <div className="card-grid">
        <div className="card"><h3>Contacts</h3><div>{stats?.contacts ?? "-"}</div></div>
        <div className="card"><h3>Companies</h3><div>{stats?.companies ?? "-"}</div></div>
        <div className="card"><h3>Open Deals</h3><div>{stats?.openDeals ?? "-"}</div><small>${stats?.openDealValue ?? 0}</small></div>
        <div className="card"><h3>Today&apos;s Changes</h3><div>{stats?.changesToday ?? "-"}</div></div>
      </div>

      <div className="card-grid two">
        <div className="card">
          <h3>Recent Activity</h3>
          <table className="table">
            <thead><tr><th>Action</th><th>Description</th><th>Time</th></tr></thead>
            <tbody>
              {logs.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.action}</td>
                  <td>{entry.description}</td>
                  <td>{new Date(entry.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card stack">
          <h3>Quick Actions</h3>
          <button className="btn btn-primary" onClick={() => apiPost("/api/prompts/execute", { id: "audit-data-quality", portalId: activePortal.id }).catch(() => undefined)}>Run Data Quality Audit</button>
          <button className="btn btn-primary" onClick={() => apiPost("/api/prompts/execute", { id: "audit-pipeline-health", portalId: activePortal.id }).catch(() => undefined)}>Check Pipeline Health</button>
          <a href="/chat" className="btn btn-ghost">View All Prompts</a>
        </div>
      </div>
    </div>
  );
}
