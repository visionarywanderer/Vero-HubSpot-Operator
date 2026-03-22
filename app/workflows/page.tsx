"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { usePortal } from "@/hooks/usePortal";
import { useToast } from "@/components/shared/Toast";
import { DraftsTable, type Draft } from "@/components/drafts/DraftsTable";
import { ContextualPrompts } from "@/components/prompts/ContextualPrompts";

type WorkflowSummary = { id?: string; flowId?: string; name?: string; type?: string; isEnabled?: boolean };
type StatusFilter = "all" | "enabled" | "disabled";
type ActiveTab = "existing" | "drafts" | "create";

export default function WorkflowsPage() {
  const { activePortal } = usePortal();
  const toast = useToast();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [specJson, setSpecJson] = useState("");
  const [validated, setValidated] = useState<Record<string, unknown> | null>(null);
  const [preview, setPreview] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tab, setTab] = useState<ActiveTab>("existing");

  const refresh = useCallback(() => {
    if (!activePortal) { setWorkflows([]); setDrafts([]); setLoading(false); return; }
    setLoading(true);
    const q = encodeURIComponent(activePortal.id);
    Promise.all([
      apiGet<{ ok: true; workflows: WorkflowSummary[] }>(`/api/workflows?portalId=${q}`).then((r) => setWorkflows(r.workflows)).catch(() => setWorkflows([])),
      apiGet<{ ok: true; drafts: Draft[] }>(`/api/workflows/drafts?portalId=${q}`).then((r) => setDrafts(r.drafts)).catch(() => setDrafts([])),
    ]).finally(() => setLoading(false));
  }, [activePortal]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return workflows.filter((w) => {
      if (statusFilter === "enabled" && !w.isEnabled) return false;
      if (statusFilter === "disabled" && w.isEnabled) return false;
      if (q && !(w.name || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [workflows, search, statusFilter]);

  const handleClone = async (w: WorkflowSummary) => {
    if (!activePortal) return;
    const flowId = w.flowId || w.id;
    if (!flowId) return;
    try {
      await apiPost("/api/workflows/clone", { portalId: activePortal.id, flowId, newName: `[VD] ${w.name || "Cloned"} (Copy)` });
      toast.success(`Cloned "${w.name}" successfully.`);
      refresh();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Clone failed"); }
  };

  const handleSaveDraft = async () => {
    if (!activePortal || !specJson.trim()) return;
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(specJson); } catch { toast.error("Invalid JSON."); return; }
    try {
      await apiPost("/api/workflows/drafts", { portalId: activePortal.id, spec: parsed });
      toast.success("Draft saved."); setSpecJson(""); refresh();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to save draft"); }
  };

  const handleValidate = async () => {
    if (!activePortal || !specJson.trim()) return;
    setValidated(null); setPreview("");
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(specJson); } catch { toast.error("Invalid JSON."); return; }
    try {
      const resp = await apiPost<{ ok: true; spec: Record<string, unknown>; validation: { valid: boolean; errors: string[] }; preview: string }>("/api/workflows/generate", { portalId: activePortal.id, spec: parsed });
      setValidated(resp.spec); setPreview(resp.preview);
      if (resp.validation.valid) toast.success("Spec is valid and ready to deploy.");
      else toast.error(`Validation errors: ${resp.validation.errors.join(", ")}`);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Validation failed"); }
  };

  const handleDeploy = async () => {
    if (!validated || !activePortal) return;
    try {
      const resp = await apiPost<{ ok: boolean; errors?: string[] }>("/api/workflows/deploy", { portalId: activePortal.id, spec: validated });
      if (resp.ok) { toast.success("Workflow deployed (disabled)."); setValidated(null); setSpecJson(""); setPreview(""); refresh(); }
      else toast.error((resp.errors || ["Deployment failed"]).join(", "));
    } catch (err) { toast.error(err instanceof Error ? err.message : "Deploy failed"); }
  };

  const handleDeployDraft = async (draft: Draft) => {
    if (!activePortal) return;
    const resp = await apiPost<{ ok: boolean; errors?: string[] }>("/api/workflows/deploy", { portalId: activePortal.id, spec: draft.spec });
    if (resp.ok) { toast.success(`"${draft.name}" deployed (disabled).`); await apiDelete(`/api/workflows/drafts/${draft.id}?portalId=${encodeURIComponent(activePortal.id)}`); refresh(); }
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

      <div className="tab-bar">
        <button className={`tab-item${tab === "existing" ? " active" : ""}`} onClick={() => setTab("existing")}>
          Existing{workflows.length > 0 ? ` (${workflows.length})` : ""}
        </button>
        <button className={`tab-item${tab === "drafts" ? " active" : ""}`} onClick={() => setTab("drafts")}>
          Drafts{drafts.length > 0 ? ` (${drafts.length})` : ""}
        </button>
        <button className={`tab-item${tab === "create" ? " active" : ""}`} onClick={() => setTab("create")}>Create</button>
      </div>

      {tab === "existing" && (
        <div className="card stack">
          <div className="search-filter-bar">
            <input className="input" placeholder="Search workflows by name..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} style={{ width: 130 }}>
              <option value="all">All Status</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
            <span className="result-count">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {loading ? (
            <div className="stack" style={{ gap: 6 }}>
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">{search || statusFilter !== "all" ? "No workflows match your filters" : "No workflows found"}</p>
              <p className="empty-state-desc">Use the Prompt Library to create workflows via MCP, or paste a JSON spec in the Create tab.</p>
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>ID</th><th style={{ width: 80 }}>Actions</th></tr></thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w.id || w.flowId}>
                    <td>{w.name || "—"}</td>
                    <td style={{ fontSize: 12 }}>{w.type || "—"}</td>
                    <td><span style={{ color: w.isEnabled ? "var(--success)" : "var(--muted)", fontWeight: 500 }}>{w.isEnabled ? "Enabled" : "Disabled"}</span></td>
                    <td style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>{w.flowId || w.id || "—"}</td>
                    <td>
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => handleClone(w)} title="Clone workflow">Clone</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "drafts" && (
        <DraftsTable
          drafts={drafts}
          portalId={activePortal?.id}
          onDeploy={handleDeployDraft}
          onDelete={handleDeleteDraft}
          onEdit={(d) => { setSpecJson(JSON.stringify(d.spec, null, 2)); setValidated(null); setPreview(""); setTab("create"); }}
          typeLabel={(spec) => String(spec.type || "—")}
        />
      )}

      {tab === "create" && (
        <div className="card stack">
          <h3>Create Workflow from JSON</h3>
          <p className="page-subtitle">Paste a workflow spec. Save as draft or validate and deploy directly.</p>
          <textarea className="textarea" rows={10} placeholder="Paste workflow JSON spec here..." value={specJson} onChange={(e) => setSpecJson(e.target.value)} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" disabled={!activePortal || !specJson.trim()} onClick={handleSaveDraft}>Save Draft</button>
            <button className="btn" disabled={!activePortal || !specJson.trim()} onClick={handleValidate}>Validate</button>
            <button className="btn btn-danger" disabled={!validated || !activePortal} onClick={handleDeploy}>Deploy Disabled</button>
          </div>
          {preview && (
            <div style={{ marginTop: 12 }}>
              <h4 style={{ margin: "0 0 8px" }}>Preview</h4>
              <pre style={{ fontFamily: "var(--font-mono)", fontSize: 12, whiteSpace: "pre-wrap", margin: 0 }}>{preview}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
