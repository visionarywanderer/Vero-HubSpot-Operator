"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { usePortal } from "@/hooks/usePortal";

type WorkflowSummary = { id?: string; flowId?: string; name?: string; type?: string; isEnabled?: boolean };

export default function WorkflowsPage() {
  const { activePortal } = usePortal();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [prompt, setPrompt] = useState("When a contact submits demo form, set lifecycle to MQL and create owner task.");
  const [generated, setGenerated] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!activePortal) {
      setWorkflows([]);
      return;
    }

    apiGet<{ ok: true; workflows: WorkflowSummary[] }>(`/api/workflows?portalId=${encodeURIComponent(activePortal.id)}`)
      .then((r) => setWorkflows(r.workflows))
      .catch(() => setWorkflows([]));
  }, [activePortal]);

  return (
    <div className="stack">
      <h1 className="page-title">Workflows</h1>
      <div className="card stack">
        <h3>Existing Workflows</h3>
        <table className="table">
          <thead><tr><th>Name</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>
            {workflows.map((w) => <tr key={w.id || w.flowId}><td>{w.name || w.id}</td><td>{w.type}</td><td>{w.isEnabled ? "Enabled" : "Disabled"}</td></tr>)}
          </tbody>
        </table>
      </div>

      <div className="card stack">
        <h3>Create New Workflow</h3>
        <textarea className="textarea" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" disabled={!activePortal} onClick={async () => {
            if (!activePortal) return;
            const resp = await apiPost<{ ok: true; spec: Record<string, unknown> }>("/api/workflows/generate", {
              portalId: activePortal.id,
              prompt
            });
            setGenerated(resp.spec);
          }}>Generate</button>
          <button className="btn btn-danger" disabled={!generated || !activePortal} onClick={async () => {
            if (!generated || !activePortal) return;
            const resp = await apiPost<{ ok: boolean; result?: { success: boolean }; errors?: string[] }>("/api/workflows/deploy", {
              portalId: activePortal.id,
              spec: generated
            });
            setStatus(resp.ok ? "Deployed disabled workflow" : (resp.errors || ["Failed"]).join(", "));
          }}>Deploy Disabled</button>
        </div>
        {generated && <pre className="card" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{JSON.stringify(generated, null, 2)}</pre>}
        {status && <div>{status}</div>}
      </div>
    </div>
  );
}
