"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { usePortal } from "@/hooks/usePortal";
import { DraftsTable, type Draft } from "@/components/drafts/DraftsTable";

type ResourceCounts = { propertyGroups?: number; properties?: number; pipelines?: number; workflows?: number; lists?: number; customObjects?: number; associations?: number };
type CloneOptions = { properties: boolean; pipelines: boolean; workflows: boolean; lists: boolean; customObjects: boolean; associations: boolean };
type ExecutionResult = { key: string; type: string; status: "success" | "error" | "skipped"; error?: string };

export default function ClonePage() {
  const { portals, activePortal } = usePortal();
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [options, setOptions] = useState<CloneOptions>({ properties: true, pipelines: true, workflows: false, lists: true, customObjects: false, associations: false });
  const [step, setStep] = useState<"select" | "preview" | "result">("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [extractedTemplate, setExtractedTemplate] = useState<Record<string, unknown> | null>(null);
  const [resourceCounts, setResourceCounts] = useState<ResourceCounts>({});
  const [results, setResults] = useState<ExecutionResult[]>([]);
  const [cloneStatus, setCloneStatus] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const otherPortals = portals.filter((p) => p.hubId !== sourceId);

  const refreshDrafts = () => {
    if (!activePortal) { setDrafts([]); return; }
    apiGet<{ ok: true; drafts: Draft[] }>(`/api/clone/drafts?portalId=${encodeURIComponent(activePortal.id)}`)
      .then((r) => setDrafts(r.drafts)).catch(() => setDrafts([]));
  };

  useEffect(() => { refreshDrafts(); }, [activePortal]);

  const handleExtract = async () => {
    if (!sourceId) return;
    setLoading(true); setError("");
    try {
      const resp = await apiPost<{ ok: true; config: { resources: Record<string, unknown[]> }; template: Record<string, unknown> }>("/api/clone/extract", { sourcePortalId: sourceId, options });
      setExtractedTemplate(resp.template);
      const resources = resp.config.resources;
      const counts: ResourceCounts = {};
      if (resources.propertyGroups) counts.propertyGroups = resources.propertyGroups.length;
      if (resources.properties) counts.properties = resources.properties.length;
      if (resources.pipelines) counts.pipelines = resources.pipelines.length;
      if (resources.workflows) counts.workflows = resources.workflows.length;
      if (resources.lists) counts.lists = resources.lists.length;
      if (resources.customObjects) counts.customObjects = resources.customObjects.length;
      if (resources.associations) counts.associations = resources.associations.length;
      setResourceCounts(counts); setStep("preview");
    } catch (err) { setError(err instanceof Error ? err.message : "Extraction failed"); }
    finally { setLoading(false); }
  };

  const handleClone = async (dryRun: boolean) => {
    if (!sourceId || !targetId) return;
    setLoading(true); setError("");
    try {
      const resp = await apiPost<{ ok: true; result: { report: { status: string; results: ExecutionResult[] } } }>("/api/clone/execute", { sourcePortalId: sourceId, targetPortalId: targetId, options, dryRun });
      setResults(resp.result.report.results);
      setCloneStatus(dryRun ? `Dry-run complete: ${resp.result.report.results.length} resources would be installed` : `Clone complete: ${resp.result.report.status}`);
      setStep("result");
    } catch (err) { setError(err instanceof Error ? err.message : "Clone failed"); }
    finally { setLoading(false); }
  };

  const handleSaveDraft = async () => {
    if (!activePortal || !extractedTemplate) return;
    setError(""); setStatus("");
    try {
      await apiPost("/api/clone/drafts", { portalId: activePortal.id, name: `Clone from ${sourceId}`, spec: { sourcePortalId: sourceId, targetPortalId: targetId, options, template: extractedTemplate } });
      setStatus("Clone config saved as draft."); refreshDrafts();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save draft"); }
  };

  const handleDeployDraft = async (draft: Draft) => {
    if (!activePortal) return;
    setError(""); setStatus("");
    const spec = draft.spec;
    const resp = await apiPost<{ ok: true; result: { report: { status: string; results: ExecutionResult[] } } }>("/api/clone/execute", {
      sourcePortalId: spec.sourcePortalId, targetPortalId: spec.targetPortalId, options: spec.options, dryRun: false,
    });
    setResults(resp.result.report.results);
    setCloneStatus(`Clone complete: ${resp.result.report.status}`);
    setStep("result");
    await apiDelete(`/api/clone/drafts/${draft.id}?portalId=${encodeURIComponent(activePortal!.id)}`);
    refreshDrafts();
  };

  const handleDeleteDraft = async (draft: Draft) => { if (!activePortal) return; await apiDelete(`/api/clone/drafts/${draft.id}?portalId=${encodeURIComponent(activePortal.id)}`); refreshDrafts(); };

  const copyTemplate = async () => { if (extractedTemplate) await navigator.clipboard.writeText(JSON.stringify(extractedTemplate, null, 2)); };
  const toggleOption = (key: keyof CloneOptions) => { setOptions((prev) => ({ ...prev, [key]: !prev[key] })); };

  return (
    <div className="stack">
      <h1 className="page-title">Portal Cloning</h1>
      <p className="page-subtitle">Clone HubSpot configuration from one portal to another. Only structure is cloned, not CRM data.</p>

      <DraftsTable
        drafts={drafts}
        portalId={activePortal?.id}
        onDeploy={handleDeployDraft}
        onDelete={handleDeleteDraft}
        onEdit={(d) => { setSourceId(String(d.spec.sourcePortalId || "")); setTargetId(String(d.spec.targetPortalId || "")); if (d.spec.options) setOptions(d.spec.options as CloneOptions); }}
        deployLabel="Execute Clone"
        typeLabel={(spec) => `${spec.sourcePortalId || "?"} → ${spec.targetPortalId || "?"}`}
      />

      {error && <div className="card" style={{ borderLeft: "3px solid var(--danger)", color: "var(--danger)" }}>{error}</div>}
      {status && <div className="card" style={{ borderLeft: "3px solid var(--success)" }}>{status}</div>}

      {step === "select" && (
        <div className="stack">
          <div className="card stack">
            <h3>Source Portal</h3>
            <select className="input" value={sourceId} onChange={(e) => { setSourceId(e.target.value); if (e.target.value === targetId) setTargetId(""); }}>
              <option value="">Select source portal...</option>
              {portals.map((p) => <option key={p.hubId} value={p.hubId}>{p.name} ({p.hubId})</option>)}
            </select>
          </div>
          <div className="card stack">
            <h3>Resources to Clone</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {(Object.keys(options) as Array<keyof CloneOptions>).map((key) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input type="checkbox" checked={options[key]} onChange={() => toggleOption(key)} />
                  {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                </label>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" disabled={!sourceId || loading} onClick={handleExtract}>{loading ? "Extracting..." : "Extract Configuration"}</button>
        </div>
      )}

      {step === "preview" && (
        <div className="stack">
          <div className="card stack">
            <h3>Extracted Configuration</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {Object.entries(resourceCounts).map(([type, count]) => (
                <div key={type} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>{count}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{type.replace(/([A-Z])/g, " $1")}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card stack">
            <h3>Target Portal</h3>
            <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Select target portal...</option>
              {otherPortals.map((p) => <option key={p.hubId} value={p.hubId}>{p.name} ({p.hubId})</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setStep("select")}>Back</button>
            <button className="btn btn-ghost" onClick={copyTemplate}>Export Template JSON</button>
            <button className="btn" onClick={handleSaveDraft} disabled={!activePortal}>Save as Draft</button>
            <button className="btn btn-primary" disabled={!targetId || loading} onClick={() => handleClone(true)}>{loading ? "Running..." : "Dry-Run Clone"}</button>
            <button className="btn btn-danger" disabled={!targetId || loading} onClick={() => handleClone(false)}>{loading ? "Cloning..." : "Execute Clone"}</button>
          </div>
        </div>
      )}

      {step === "result" && (
        <div className="stack">
          {cloneStatus && <div className="card" style={{ borderLeft: "3px solid var(--success)" }}>{cloneStatus}</div>}
          <div className="card stack">
            <h3>Results</h3>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>Resource</th>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>Type</th>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>Error</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)", fontSize: 11 }}>{r.key}</td>
                    <td style={{ padding: "6px 8px" }}>{r.type}</td>
                    <td style={{ padding: "6px 8px" }}><span style={{ color: r.status === "success" ? "var(--success)" : r.status === "error" ? "var(--danger)" : "var(--muted)" }}>{r.status}</span></td>
                    <td style={{ padding: "6px 8px", fontSize: 11, color: "var(--danger)" }}>{r.error || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => { setStep("select"); setResults([]); setCloneStatus(""); }}>Start Over</button>
          </div>
        </div>
      )}
    </div>
  );
}
