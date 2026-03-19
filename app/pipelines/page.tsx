"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { usePortal } from "@/hooks/usePortal";
import { DraftsTable, type Draft } from "@/components/drafts/DraftsTable";

type Stage = {
  id?: string; stageId?: string; label: string; displayOrder?: number;
  metadata?: Record<string, string>; createdAt?: string; updatedAt?: string; archived?: boolean;
  [key: string]: unknown;
};

type Pipeline = {
  id?: string; pipelineId?: string; label: string; displayOrder?: number;
  stages: Stage[]; createdAt?: string; updatedAt?: string; archived?: boolean;
  [key: string]: unknown;
};

const OBJECT_TYPES = ["deals", "tickets"] as const;

export default function PipelinesPage() {
  const { activePortal } = usePortal();
  const [objectType, setObjectType] = useState<"deals" | "tickets">("deals");
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newStagesText, setNewStagesText] = useState("");
  const [addingStageFor, setAddingStageFor] = useState<string | null>(null);
  const [addStageLabel, setAddStageLabel] = useState("");
  const [specJson, setSpecJson] = useState("");
  const [showJsonInput, setShowJsonInput] = useState(false);

  const refresh = useCallback(() => {
    if (!activePortal) { setPipelines([]); setDrafts([]); return; }
    setLoading(true);
    const q = encodeURIComponent(activePortal.id);
    apiGet<{ ok: true; pipelines: Pipeline[] }>(`/api/pipelines?portalId=${q}&objectType=${objectType}`)
      .then((r) => setPipelines(r.pipelines)).catch(() => setPipelines([])).finally(() => setLoading(false));
    apiGet<{ ok: true; drafts: Draft[] }>(`/api/pipelines/drafts?portalId=${q}`)
      .then((r) => setDrafts(r.drafts)).catch(() => setDrafts([]));
  }, [activePortal, objectType]);

  useEffect(() => { refresh(); }, [refresh]);

  const getPipelineId = (p: Pipeline) => String(p.id ?? p.pipelineId ?? "");
  const getStageId = (s: Stage) => String(s.id ?? s.stageId ?? "");

  const handleCreate = async () => {
    if (!activePortal || !newLabel.trim()) return;
    setError(""); setStatus("");
    const stages = newStagesText.split("\n").map((l) => l.trim()).filter(Boolean).map((label, i) => ({ label, displayOrder: i }));
    if (stages.length === 0) { setError("Add at least one stage (one per line)."); return; }
    try {
      await apiPost("/api/pipelines", { portalId: activePortal.id, objectType, spec: { label: newLabel.trim(), stages } });
      setStatus(`Pipeline "${newLabel}" created.`); setNewLabel(""); setNewStagesText(""); setShowCreate(false); refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Create failed"); }
  };

  const handleDeletePipeline = async (id: string) => {
    if (!activePortal || !confirm("Delete this pipeline and all its stages?")) return;
    setError("");
    try { await apiDelete(`/api/pipelines/${objectType}/${id}?portalId=${encodeURIComponent(activePortal.id)}`); setStatus("Pipeline deleted."); refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
  };

  const handleAddStage = async (pipelineId: string) => {
    if (!activePortal || !addStageLabel.trim()) return;
    setError("");
    try {
      await apiPost(`/api/pipelines/${objectType}/${pipelineId}/stages?portalId=${encodeURIComponent(activePortal.id)}`, { portalId: activePortal.id, stage: { label: addStageLabel.trim(), displayOrder: 99 } });
      setStatus(`Stage "${addStageLabel}" added.`); setAddStageLabel(""); setAddingStageFor(null); refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Add stage failed"); }
  };

  const handleDeleteStage = async (pipelineId: string, stageId: string, stageLabel: string) => {
    if (!activePortal || !confirm(`Delete stage "${stageLabel}"?`)) return;
    setError("");
    try { await apiDelete(`/api/pipelines/${objectType}/${pipelineId}/stages/${stageId}?portalId=${encodeURIComponent(activePortal.id)}`); setStatus(`Stage "${stageLabel}" deleted.`); refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Delete stage failed"); }
  };

  const handleSaveDraft = async () => {
    if (!activePortal || !specJson.trim()) return;
    setError(""); setStatus("");
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(specJson); } catch { setError("Invalid JSON."); return; }
    try {
      await apiPost("/api/pipelines/drafts", { portalId: activePortal.id, spec: parsed });
      setStatus("Draft saved."); setSpecJson(""); refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save draft"); }
  };

  const handleDeployDraft = async (draft: Draft) => {
    if (!activePortal) return;
    setError(""); setStatus("");
    const spec = draft.spec;
    const ot = String(spec.objectType || objectType);
    await apiPost("/api/pipelines", { portalId: activePortal.id, objectType: ot, spec });
    setStatus(`"${draft.name}" created.`);
    await apiDelete(`/api/pipelines/drafts/${draft.id}`);
    refresh();
  };

  const handleDeleteDraft = async (draft: Draft) => {
    if (!activePortal) return;
    await apiDelete(`/api/pipelines/drafts/${draft.id}?portalId=${encodeURIComponent(activePortal.id)}`); refresh();
  };

  return (
    <div className="stack">
      <h1 className="page-title">Pipelines</h1>

      <DraftsTable
        drafts={drafts}
        portalId={activePortal?.id}
        onDeploy={handleDeployDraft}
        onDelete={handleDeleteDraft}
        onEdit={(d) => { setSpecJson(JSON.stringify(d.spec, null, 2)); setShowJsonInput(true); }}
        deployLabel="Create"
        typeLabel={(spec) => String(spec.objectType || "—")}
      />

      <div className="card" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select className="input" style={{ width: "auto" }} value={objectType} onChange={(e) => setObjectType(e.target.value as "deals" | "tickets")}>
          {OBJECT_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => { setShowJsonInput(!showJsonInput); setShowCreate(false); }}>
          {showJsonInput ? "Cancel JSON" : "From JSON"}
        </button>
        <button className="btn btn-primary" onClick={() => { setShowCreate(!showCreate); setShowJsonInput(false); }}>
          {showCreate ? "Cancel" : "Create Pipeline"}
        </button>
      </div>

      {error && <div className="card" style={{ borderLeft: "3px solid var(--danger)", color: "var(--danger)" }}>{error}</div>}
      {status && <div className="card" style={{ borderLeft: "3px solid var(--success)" }}>{status}</div>}

      {showJsonInput && (
        <div className="card stack">
          <h3>Pipeline from JSON</h3>
          <textarea className="textarea" rows={8} placeholder="Paste pipeline JSON spec..." value={specJson} onChange={(e) => setSpecJson(e.target.value)} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" disabled={!activePortal || !specJson.trim()} onClick={handleSaveDraft}>Save Draft</button>
            <button className="btn btn-danger" disabled={!activePortal || !specJson.trim()} onClick={async () => {
              if (!activePortal || !specJson.trim()) return;
              let parsed: Record<string, unknown>;
              try { parsed = JSON.parse(specJson); } catch { setError("Invalid JSON."); return; }
              try {
                await apiPost("/api/pipelines", { portalId: activePortal.id, objectType: String(parsed.objectType || objectType), spec: parsed });
                setStatus("Pipeline created."); setSpecJson(""); setShowJsonInput(false); refresh();
              } catch (err) { setError(err instanceof Error ? err.message : "Create failed"); }
            }}>Create Now</button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="card stack">
          <h3>Create Pipeline</h3>
          <div>
            <label className="field-label">Pipeline Name</label>
            <input className="input" placeholder="e.g. Sales Pipeline" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Stages (one per line)</label>
            <textarea className="textarea" rows={6} placeholder={"Qualification\nNeeds Analysis\nProposal\nNegotiation\nClosed Won\nClosed Lost"} value={newStagesText} onChange={(e) => setNewStagesText(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={!newLabel.trim()} onClick={handleCreate} style={{ width: "fit-content" }}>Create</button>
        </div>
      )}

      <div style={{ fontSize: 12, color: "var(--muted)" }}>{loading ? "Loading..." : `${pipelines.length} pipeline(s)`}</div>

      {pipelines.map((p) => {
        const id = getPipelineId(p);
        const isExpanded = expanded === id;
        const stages = Array.isArray(p.stages) ? [...p.stages].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)) : [];
        return (
          <div key={id} className="card stack" style={{ gap: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0" }} onClick={() => setExpanded(isExpanded ? null : id)}>
              <span style={{ fontSize: 12, width: 16, textAlign: "center", color: "var(--muted)" }}>{isExpanded ? "▼" : "▶"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{p.label}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 12, marginTop: 2, flexWrap: "wrap" }}>
                  <span>ID: <code style={{ fontSize: 10 }}>{id}</code></span>
                  <span>{stages.length} stage{stages.length !== 1 ? "s" : ""}</span>
                  {p.displayOrder !== undefined && <span>Order: {p.displayOrder}</span>}
                  {p.createdAt && <span>Created: {new Date(String(p.createdAt)).toLocaleDateString()}</span>}
                  {p.updatedAt && <span>Updated: {new Date(String(p.updatedAt)).toLocaleDateString()}</span>}
                </div>
              </div>
              <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={(e) => { e.stopPropagation(); handleDeletePipeline(id); }}>Delete</button>
            </div>
            {isExpanded && (
              <div style={{ marginTop: 8, marginLeft: 24 }}>
                {stages.length > 0 && (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Order</th><th>Label</th><th>Stage ID</th>
                        {objectType === "deals" && <th>Won</th>}
                        {objectType === "deals" && <th>Lost</th>}
                        {objectType === "deals" && <th>Prob.</th>}
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {stages.map((s, i) => {
                        const meta = s.metadata || {};
                        const sid = getStageId(s);
                        const isClosedWon = meta.isClosed === "true" && meta.closedWon === "true";
                        const isClosedLost = meta.isClosed === "true" && meta.closedWon === "false";
                        return (
                          <tr key={sid || i}>
                            <td style={{ fontSize: 12, textAlign: "center" }}>{s.displayOrder ?? i}</td>
                            <td><span style={{ fontWeight: isClosedWon || isClosedLost ? 600 : 400 }}>{s.label}</span></td>
                            <td style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>{sid || "—"}</td>
                            {objectType === "deals" && <td style={{ textAlign: "center", color: isClosedWon ? "var(--success)" : "var(--muted)" }}>{isClosedWon ? "Yes" : "—"}</td>}
                            {objectType === "deals" && <td style={{ textAlign: "center", color: isClosedLost ? "var(--danger)" : "var(--muted)" }}>{isClosedLost ? "Yes" : "—"}</td>}
                            {objectType === "deals" && <td style={{ textAlign: "center", fontSize: 12 }}>{meta.probability != null ? `${meta.probability}%` : "—"}</td>}
                            <td><button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => handleDeleteStage(id, sid, s.label)}>Delete</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {stages.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>No stages found.</div>}
                {objectType === "deals" && stages.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
                    {stages.some((s) => s.metadata?.isClosed === "true" && s.metadata?.closedWon === "true") ? "Has Closed Won stage" : "Missing Closed Won stage"}
                    {" · "}
                    {stages.some((s) => s.metadata?.isClosed === "true" && s.metadata?.closedWon === "false") ? "Has Closed Lost stage" : "Missing Closed Lost stage"}
                  </div>
                )}
                {addingStageFor === id ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                    <input className="input" style={{ flex: 1 }} placeholder="New stage label..." value={addStageLabel} onChange={(e) => setAddStageLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAddStage(id); }} />
                    <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={!addStageLabel.trim()} onClick={() => handleAddStage(id)}>Add</button>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setAddingStageFor(null); setAddStageLabel(""); }}>Cancel</button>
                  </div>
                ) : (
                  <button className="btn btn-ghost" style={{ fontSize: 11, marginTop: 8 }} onClick={() => { setAddingStageFor(id); setAddStageLabel(""); }}>+ Add Stage</button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {!loading && pipelines.length === 0 && (
        <div className="card" style={{ color: "var(--muted)", textAlign: "center" }}>No pipelines found for {objectType}.</div>
      )}
    </div>
  );
}
