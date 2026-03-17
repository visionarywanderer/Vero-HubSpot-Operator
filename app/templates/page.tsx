"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { usePortal } from "@/hooks/usePortal";
import { DraftsTable, type Draft } from "@/components/drafts/DraftsTable";
import type {
  TemplateDefinition,
  PackDefinition,
  ExecutionReport,
  ResourceExecutionResult,
} from "@/lib/template-types";

type InstallState =
  | { phase: "idle" }
  | { phase: "confirming"; templateId: string; templateName: string }
  | { phase: "installing"; templateId: string }
  | { phase: "done"; report: ExecutionReport }
  | { phase: "error"; message: string };

function ResourceResult({ result }: { result: ResourceExecutionResult }) {
  const statusColor = result.status === "success" ? "var(--green)" : result.status === "error" ? "var(--red)" : "var(--muted)";
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "4px 0" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
      <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-secondary)" }}>{result.type}</span>
      <span>{result.key}</span>
      {result.hubspotId && <span style={{ color: "var(--muted)", fontSize: 11 }}>ID: {result.hubspotId}</span>}
      {result.error && <span style={{ color: "var(--red)", fontSize: 11 }}>{result.error}</span>}
    </div>
  );
}

function TemplateCard({ template, onInstall }: { template: TemplateDefinition; onInstall: (id: string, name: string) => void }) {
  const resourceCounts: string[] = [];
  const r = template.resources;
  if (r.propertyGroups?.length) resourceCounts.push(`${r.propertyGroups.length} groups`);
  if (r.properties?.length) resourceCounts.push(`${r.properties.length} properties`);
  if (r.pipelines?.length) resourceCounts.push(`${r.pipelines.length} pipelines`);
  if (r.workflows?.length) resourceCounts.push(`${r.workflows.length} workflows`);
  if (r.lists?.length) resourceCounts.push(`${r.lists.length} lists`);
  if (r.customObjects?.length) resourceCounts.push(`${r.customObjects.length} custom objects`);
  if (r.associations?.length) resourceCounts.push(`${r.associations.length} associations`);
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>{template.name}</h3>
          <p style={{ margin: "4px 0 8px", color: "var(--fg-secondary)", fontSize: 13 }}>{template.description}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{template.tags?.map((tag) => <span key={tag} className="badge">{tag}</span>)}</div>
          {resourceCounts.length > 0 && <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>{resourceCounts.join(" · ")}</p>}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: "var(--muted)", alignSelf: "center" }}>v{template.version}</span>
          <button className="btn btn-primary" onClick={() => onInstall(template.id, template.name)}>Install</button>
        </div>
      </div>
    </div>
  );
}

function PackCard({ pack }: { pack: PackDefinition }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>{pack.name}</h3>
      <p style={{ margin: "4px 0 8px", color: "var(--fg-secondary)", fontSize: 13 }}>{pack.description}</p>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>{pack.templateIds.length} template{pack.templateIds.length !== 1 ? "s" : ""}</p>
    </div>
  );
}

export default function TemplatesPage() {
  const { activePortal } = usePortal();
  const [templates, setTemplates] = useState<TemplateDefinition[]>([]);
  const [packs, setPacks] = useState<PackDefinition[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [installState, setInstallState] = useState<InstallState>({ phase: "idle" });
  const [specJson, setSpecJson] = useState("");
  const [showJsonInput, setShowJsonInput] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = (await res.json()) as { templates: TemplateDefinition[]; packs: PackDefinition[] };
        setTemplates(data.templates); setPacks(data.packs);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  const refreshDrafts = () => {
    if (!activePortal) { setDrafts([]); return; }
    apiGet<{ ok: true; drafts: Draft[] }>(`/api/templates/drafts?portalId=${encodeURIComponent(activePortal.id)}`)
      .then((r) => setDrafts(r.drafts)).catch(() => setDrafts([]));
  };

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);
  useEffect(() => { refreshDrafts(); }, [activePortal]);

  const handleInstallRequest = (templateId: string, templateName: string) => {
    if (!activePortal) return;
    setInstallState({ phase: "confirming", templateId, templateName });
  };

  const handleConfirmInstall = async () => {
    if (installState.phase !== "confirming" || !activePortal) return;
    const { templateId } = installState;
    setInstallState({ phase: "installing", templateId });
    try {
      const res = await fetch("/api/templates/install", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId, portalId: activePortal.id }) });
      const report = (await res.json()) as ExecutionReport;
      setInstallState({ phase: "done", report });
    } catch (error) { setInstallState({ phase: "error", message: error instanceof Error ? error.message : "Installation failed" }); }
  };

  const handleSaveDraft = async () => {
    if (!activePortal || !specJson.trim()) return;
    setError(""); setStatus("");
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(specJson); } catch { setError("Invalid JSON."); return; }
    try { await apiPost("/api/templates/drafts", { portalId: activePortal.id, spec: parsed }); setStatus("Template draft saved."); setSpecJson(""); refreshDrafts(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to save draft"); }
  };

  const handleDeployDraft = async (draft: Draft) => {
    if (!activePortal) return;
    setError(""); setStatus("");
    const res = await fetch("/api/templates/install", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resources: draft.spec.resources || draft.spec, portalId: activePortal.id }) });
    const report = (await res.json()) as ExecutionReport;
    if (report.status === "success" || report.status === "partial") {
      setStatus(`"${draft.name}" installed.`);
      await apiDelete(`/api/templates/drafts/${draft.id}`);
      refreshDrafts();
    }
    setInstallState({ phase: "done", report });
  };

  const handleDeleteDraft = async (draft: Draft) => { if (!activePortal) return; await apiDelete(`/api/templates/drafts/${draft.id}?portalId=${encodeURIComponent(activePortal.id)}`); refreshDrafts(); };

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Templates</h1>
        <p className="page-subtitle">Browse and install HubSpot configuration templates.</p>
        <div className="accent-stripe" />
      </div>

      {!activePortal && (
        <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--fg-secondary)" }}>Connect a portal first to install templates.</div>
      )}

      <DraftsTable
        drafts={drafts}
        portalId={activePortal?.id}
        onDeploy={handleDeployDraft}
        onDelete={handleDeleteDraft}
        onEdit={(d) => { setSpecJson(JSON.stringify(d.spec, null, 2)); setShowJsonInput(true); }}
        deployLabel="Install"
        typeLabel={(spec) => {
          const r = (spec.resources || spec) as Record<string, unknown[]>;
          const counts: string[] = [];
          if (Array.isArray(r.properties)) counts.push(`${r.properties.length} props`);
          if (Array.isArray(r.pipelines)) counts.push(`${r.pipelines.length} pipes`);
          if (Array.isArray(r.workflows)) counts.push(`${r.workflows.length} wf`);
          return counts.join(", ") || "—";
        }}
      />

      {error && <div className="card" style={{ borderLeft: "3px solid var(--danger)", color: "var(--danger)" }}>{error}</div>}
      {status && <div className="card" style={{ borderLeft: "3px solid var(--success)" }}>{status}</div>}

      <div className="card" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn" onClick={() => setShowJsonInput(!showJsonInput)}>
          {showJsonInput ? "Cancel JSON" : "Save Template from JSON"}
        </button>
      </div>

      {showJsonInput && (
        <div className="card stack">
          <h3>Template from JSON</h3>
          <p className="page-subtitle">Paste a template spec with resources to save as a draft.</p>
          <textarea className="textarea" rows={10} placeholder="Paste template JSON spec..." value={specJson} onChange={(e) => setSpecJson(e.target.value)} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" disabled={!activePortal || !specJson.trim()} onClick={handleSaveDraft}>Save Draft</button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading templates...</p>
      ) : templates.length === 0 && packs.length === 0 ? (
        <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--fg-secondary)" }}>
          No templates available yet. Add template JSON files to the <code>templates/</code> directory.
        </div>
      ) : (
        <>
          {templates.length > 0 && (
            <div className="stack">
              <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)" }}>Templates</h2>
              {templates.map((t) => <TemplateCard key={t.id} template={t} onInstall={handleInstallRequest} />)}
            </div>
          )}
          {packs.length > 0 && (
            <div className="stack" style={{ marginTop: 24 }}>
              <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)" }}>Installation Packs</h2>
              {packs.map((p) => <PackCard key={p.id} pack={p} />)}
            </div>
          )}
        </>
      )}

      {installState.phase === "confirming" && (
        <div className="modal-overlay" onClick={() => setInstallState({ phase: "idle" })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Install Template</h3>
            <p>Install <strong>{installState.templateName}</strong> to portal <strong>{activePortal?.name}</strong>?</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn" onClick={() => setInstallState({ phase: "idle" })}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmInstall}>Install</button>
            </div>
          </div>
        </div>
      )}
      {installState.phase === "installing" && (
        <div className="modal-overlay"><div className="modal-content"><h3>Installing...</h3><p style={{ color: "var(--fg-secondary)" }}>Installing template to {activePortal?.name}.</p></div></div>
      )}
      {installState.phase === "done" && (
        <div className="modal-overlay" onClick={() => setInstallState({ phase: "idle" })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <h3>Installation {installState.report.status === "success" ? "Complete" : installState.report.status === "partial" ? "Partial" : "Failed"}</h3>
            <div style={{ maxHeight: 300, overflow: "auto" }}>{installState.report.results.map((r, i) => <ResourceResult key={i} result={r} />)}</div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}><button className="btn btn-primary" onClick={() => setInstallState({ phase: "idle" })}>Close</button></div>
          </div>
        </div>
      )}
      {installState.phase === "error" && (
        <div className="modal-overlay" onClick={() => setInstallState({ phase: "idle" })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: "var(--red)" }}>Installation Error</h3><p>{installState.message}</p>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}><button className="btn" onClick={() => setInstallState({ phase: "idle" })}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
