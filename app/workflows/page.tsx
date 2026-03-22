"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { usePortal } from "@/hooks/usePortal";
import { DraftsTable, type Draft } from "@/components/drafts/DraftsTable";
import { ContextualPrompts } from "@/components/prompts/ContextualPrompts";

type WorkflowSummary = { id?: string; flowId?: string; name?: string; type?: string; isEnabled?: boolean };

export default function WorkflowsPage() {
  const { activePortal } = usePortal();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [specJson, setSpecJson] = useState("");
  const [validated, setValidated] = useState<Record<string, unknown> | null>(null);
  const [preview, setPreview] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    if (!activePortal) { setWorkflows([]); setDrafts([]); return; }
    const q = encodeURIComponent(activePortal.id);
    apiGet<{ ok: true; workflows: WorkflowSummary[] }>(`/api/workflows?portalId=${q}`)
      .then((r) => setWorkflows(r.workflows)).catch(() => setWorkflows([]));
    apiGet<{ ok: true; drafts: Draft[] }>(`/api/workflows/drafts?portalId=${q}`)
      .then((r) => setDrafts(r.drafts)).catch(() => setDrafts([]));
  }, [activePortal]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSaveDraft = async () => {
    if (!activePortal || !specJson.trim()) return;
    setError(""); setStatus("");
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(specJson); } catch { setError("Invalid JSON."); return; }
    try {
      await apiPost("/api/workflows/drafts", { portalId: activePortal.id, spec: parsed });
      setStatus("Draft saved."); setSpecJson(""); refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save draft"); }
  };

  const handleValidate = async () => {
    if (!activePortal || !specJson.trim()) return;
    setError(""); setStatus(""); setValidated(null); setPreview("");
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(specJson); } catch { setError("Invalid JSON."); return; }
    try {
      const resp = await apiPost<{ ok: true; spec: Record<string, unknown>; validation: { valid: boolean; errors: string[] }; preview: string }>("/api/workflows/generate", { portalId: activePortal.id, spec: parsed });
      setValidated(resp.spec); setPreview(resp.preview);
      if (resp.validation.valid) setStatus("Spec is valid and ready to deploy.");
      else setError(`Validation errors: ${resp.validation.errors.join(", ")}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Validation failed"); }
  };

  const handleDeploy = async () => {
    if (!validated || !activePortal) return;
    setError("");
    try {
      const resp = await apiPost<{ ok: boolean; errors?: string[] }>("/api/workflows/deploy", { portalId: activePortal.id, spec: validated });
      if (resp.ok) { setStatus("Workflow deployed (disabled)."); setValidated(null); setSpecJson(""); setPreview(""); refresh(); }
      else setError((resp.errors || ["Deployment failed"]).join(", "));
    } catch (err) { setError(err instanceof Error ? err.message : "Deploy failed"); }
  };

  const handleDeployDraft = async (draft: Draft) => {
    if (!activePortal) return;
    setError(""); setStatus("");
    const resp = await apiPost<{ ok: boolean; errors?: string[] }>("/api/workflows/deploy", { portalId: activePortal.id, spec: draft.spec });
    if (resp.ok) { setStatus(`"${draft.name}" deployed (disabled).`); await apiDelete(`/api/workflows/drafts/${draft.id}?portalId=${encodeURIComponent(activePortal.id)}`); refresh(); }
    else throw new Error((resp.errors || ["Deployment failed"]).join(", "));
  };

  const handleDeleteDraft = async (draft: Draft) => {
    if (!activePortal) return;
    await apiDelete(`/api/workflows/drafts/${draft.id}?portalId=${encodeURIComponent(activePortal.id)}`); refresh();
  };

  return (
    <div className="stack">
      <h1 className="page-title">Workflows</h1>

      <ContextualPrompts categories={["workflow", "workflow-management"]} />

      <DraftsTable
        drafts={drafts}
        portalId={activePortal?.id}
        onDeploy={handleDeployDraft}
        onDelete={handleDeleteDraft}
        onEdit={(d) => { setSpecJson(JSON.stringify(d.spec, null, 2)); setValidated(null); setPreview(""); }}
        typeLabel={(spec) => String(spec.type || "—")}
      />

      <div className="card stack">
        <h3>Existing Workflows</h3>
        {workflows.length === 0 ? (
          <p className="page-subtitle">No workflows found on this portal.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>ID</th></tr></thead>
            <tbody>
              {workflows.map((w) => (
                <tr key={w.id || w.flowId}>
                  <td>{w.name || "—"}</td>
                  <td style={{ fontSize: 12 }}>{w.type || "—"}</td>
                  <td><span style={{ color: w.isEnabled ? "var(--success)" : "var(--muted)", fontWeight: 500 }}>{w.isEnabled ? "Enabled" : "Disabled"}</span></td>
                  <td style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>{w.flowId || w.id || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card stack">
        <h3>Create Workflow from JSON</h3>
        <p className="page-subtitle">Paste a workflow spec. Save as draft or validate and deploy directly.</p>
        <textarea className="textarea" rows={10} placeholder="Paste workflow JSON spec here..." value={specJson} onChange={(e) => setSpecJson(e.target.value)} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" disabled={!activePortal || !specJson.trim()} onClick={handleSaveDraft}>Save Draft</button>
          <button className="btn" disabled={!activePortal || !specJson.trim()} onClick={handleValidate}>Validate</button>
          <button className="btn btn-danger" disabled={!validated || !activePortal} onClick={handleDeploy}>Deploy Disabled</button>
        </div>
      </div>

      {error && <div className="card" style={{ borderLeft: "3px solid var(--danger)", color: "var(--danger)" }}>{error}</div>}
      {status && <div className="card" style={{ borderLeft: "3px solid var(--success)" }}>{status}</div>}
      {preview && (
        <div className="card stack">
          <h3>Preview</h3>
          <pre style={{ fontFamily: "var(--font-mono)", fontSize: 12, whiteSpace: "pre-wrap", margin: 0 }}>{preview}</pre>
        </div>
      )}
    </div>
  );
}
