"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { usePortal } from "@/hooks/usePortal";
import { DraftsTable, type Draft } from "@/components/drafts/DraftsTable";

type RegisteredScript = { id: string; module: string; description: string; code: string };

export default function BulkPage() {
  const { activePortal } = usePortal();
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [script, setScript] = useState<RegisteredScript | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const refreshDrafts = () => {
    if (!activePortal) { setDrafts([]); return; }
    apiGet<{ ok: true; drafts: Draft[] }>(`/api/scripts/drafts?portalId=${encodeURIComponent(activePortal.id)}`)
      .then((r) => setDrafts(r.drafts)).catch(() => setDrafts([]));
  };

  useEffect(() => { refreshDrafts(); }, [activePortal]);

  const handleSaveDraft = async () => {
    if (!activePortal || !code.trim()) return;
    setError(""); setStatus("");
    try {
      await apiPost("/api/scripts/drafts", { portalId: activePortal.id, spec: { code: code.trim(), description: description.trim() || undefined } });
      setStatus("Draft saved."); refreshDrafts();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save draft"); }
  };

  const handleDeployDraft = async (draft: Draft) => {
    if (!activePortal) return;
    setError(""); setStatus("");
    const resp = await apiPost<{ ok: true; script: RegisteredScript }>("/api/scripts/generate", {
      portalId: activePortal.id,
      code: String(draft.spec.code || ""),
      description: String(draft.spec.description || ""),
    });
    setScript(resp.script);
    setStatus("Script registered from draft. Run a dry-run before executing.");
    await apiDelete(`/api/scripts/drafts/${draft.id}?portalId=${encodeURIComponent(activePortal.id)}`);
    refreshDrafts();
  };

  const handleDeleteDraft = async (draft: Draft) => { if (!activePortal) return; await apiDelete(`/api/scripts/drafts/${draft.id}?portalId=${encodeURIComponent(activePortal.id)}`); refreshDrafts(); };

  return (
    <div className="stack">
      <h1 className="page-title">Bulk Operations</h1>
      <p className="page-subtitle">Paste a pre-generated script from Claude Skills to register and execute it against the active portal.</p>

      <DraftsTable
        drafts={drafts}
        portalId={activePortal?.id}
        onDeploy={handleDeployDraft}
        onDelete={handleDeleteDraft}
        onEdit={(d) => { setCode(String(d.spec.code || "")); setDescription(String(d.spec.description || "")); }}
        deployLabel="Register"
      />

      <div className="card stack">
        <label className="field-label">Description</label>
        <input className="input" placeholder="What does this script do?" value={description} onChange={(e) => setDescription(e.target.value)} />

        <label className="field-label">Script Code</label>
        <textarea className="textarea" rows={12} placeholder="Paste your generated script code here..." value={code} onChange={(e) => setCode(e.target.value)} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" disabled={!activePortal || !code.trim()} onClick={handleSaveDraft}>Save Draft</button>
          <button className="btn btn-primary" disabled={!activePortal || !code.trim()} onClick={async () => {
            if (!activePortal || !code.trim()) return;
            setError(""); setStatus("");
            try {
              const resp = await apiPost<{ ok: true; script: RegisteredScript }>("/api/scripts/generate", { portalId: activePortal.id, code: code.trim(), description: description.trim() || undefined });
              setScript(resp.script); setStatus("Script registered. Run a dry-run before executing.");
            } catch (err) { setError(err instanceof Error ? err.message : "Registration failed"); }
          }}>Register Script</button>
          <button className="btn btn-ghost" disabled={!script} onClick={async () => {
            if (!script) return; setError("");
            try { const resp = await apiPost<{ ok: true; result: { recordsChanged: number } }>("/api/scripts/dry-run", { script }); setStatus(`Dry-run complete. Pending changes: ${resp.result.recordsChanged}`); }
            catch (err) { setError(err instanceof Error ? err.message : "Dry-run failed"); }
          }}>Run Dry-Run</button>
          <button className="btn btn-danger" disabled={!script} onClick={async () => {
            if (!script) return; setError("");
            try { const resp = await apiPost<{ ok: true; result: { recordsChanged: number } }>("/api/scripts/execute", { script, mode: "execute" }); setStatus(`Executed. Changes: ${resp.result.recordsChanged}`); }
            catch (err) { setError(err instanceof Error ? err.message : "Execution failed"); }
          }}>Execute for Real</button>
        </div>
      </div>

      {error && <div className="card" style={{ borderLeft: "3px solid var(--danger)", color: "var(--danger)" }}>{error}</div>}
      {status && <div className="card" style={{ borderLeft: "3px solid var(--success)" }}>{status}</div>}
      {script && (
        <div className="card stack">
          <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
            <span><strong>ID:</strong> {script.id}</span>
            <span><strong>Module:</strong> {script.module}</span>
          </div>
          <pre style={{ fontFamily: "var(--font-mono)", fontSize: 12, overflow: "auto", margin: 0 }}>{script.code}</pre>
        </div>
      )}
    </div>
  );
}
