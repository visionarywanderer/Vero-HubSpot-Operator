"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { usePortal } from "@/hooks/usePortal";

type Snapshot = {
  id: string;
  portalId: string;
  templateId: string;
  templateVersion: string;
  status: "active" | "rolled_back";
  createdAt: string;
  rolledBackAt: string | null;
};

export default function DeploymentsPage() {
  const { activePortal } = usePortal();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!activePortal) return;
    setLoading(true);
    try {
      const resp = await apiGet<{ ok: true; snapshots: Snapshot[] }>(
        `/api/snapshots?portalId=${activePortal.hubId}`
      );
      setSnapshots(resp.snapshots);
    } catch {
      setError("Failed to load deployment history");
    } finally {
      setLoading(false);
    }
  }, [activePortal]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRollback = async (id: string, dryRun: boolean) => {
    setRollingBack(id);
    setError("");
    setStatus("");
    try {
      const resp = await apiPost<{
        ok: true;
        result: {
          snapshot: Snapshot;
          report: { status: string; results: Array<{ key: string; status: string }> } | null;
        };
      }>(`/api/snapshots/${id}/rollback`, { dryRun });

      if (dryRun) {
        const count = resp.result.report?.results.length ?? 0;
        setStatus(`Dry-run rollback: ${count} resources would be restored`);
      } else {
        setStatus("Rollback executed successfully");
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback failed");
    } finally {
      setRollingBack(null);
    }
  };

  return (
    <div className="stack">
      <h1 className="page-title">Deployment History</h1>
      <p className="page-subtitle">
        View deployment snapshots for the active portal. Rollback to a previous configuration state if needed.
      </p>

      {error && <div className="card" style={{ borderLeft: "3px solid var(--danger)", color: "var(--danger)" }}>{error}</div>}
      {status && <div className="card" style={{ borderLeft: "3px solid var(--success)" }}>{status}</div>}

      {!activePortal ? (
        <div className="card"><p className="page-subtitle">Select a portal to view deployments.</p></div>
      ) : loading ? (
        <div className="card"><p>Loading...</p></div>
      ) : snapshots.length === 0 ? (
        <div className="card"><p className="page-subtitle">No deployment snapshots found for this portal.</p></div>
      ) : (
        <div className="card">
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <th style={{ textAlign: "left", padding: "6px 8px" }}>Date</th>
                <th style={{ textAlign: "left", padding: "6px 8px" }}>Template</th>
                <th style={{ textAlign: "left", padding: "6px 8px" }}>Version</th>
                <th style={{ textAlign: "left", padding: "6px 8px" }}>Status</th>
                <th style={{ textAlign: "right", padding: "6px 8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snap) => (
                <tr key={snap.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "6px 8px" }}>{new Date(snap.createdAt).toLocaleString()}</td>
                  <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    {snap.templateId || "—"}
                  </td>
                  <td style={{ padding: "6px 8px" }}>{snap.templateVersion || "—"}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <span style={{
                      color: snap.status === "active" ? "var(--success)" : "var(--muted)",
                      fontWeight: 500,
                    }}>
                      {snap.status}
                    </span>
                    {snap.rolledBackAt && (
                      <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 6 }}>
                        rolled back {new Date(snap.rolledBackAt).toLocaleDateString()}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>
                    {snap.status === "active" && (
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 11 }}
                          disabled={rollingBack === snap.id}
                          onClick={() => handleRollback(snap.id, true)}
                        >
                          Dry-Run
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ fontSize: 11 }}
                          disabled={rollingBack === snap.id}
                          onClick={() => handleRollback(snap.id, false)}
                        >
                          Rollback
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
