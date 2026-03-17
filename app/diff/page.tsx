"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { usePortal } from "@/hooks/usePortal";

type ResourceDiff = {
  added: string[];
  modified: string[];
  removed: string[];
  unchanged: string[];
};

type ConfigDiff = {
  properties: ResourceDiff;
  propertyGroups: ResourceDiff;
  pipelines: ResourceDiff;
  workflows: ResourceDiff;
  lists: ResourceDiff;
  customObjects: ResourceDiff;
  associations: ResourceDiff;
  summary: {
    totalAdded: number;
    totalModified: number;
    totalRemoved: number;
    totalUnchanged: number;
  };
};

type TemplateVersion = {
  id: string;
  templateId: string;
  version: string;
  description: string;
  resources: unknown;
  createdAt: string;
};

const RESOURCE_TYPES = [
  "propertyGroups",
  "properties",
  "pipelines",
  "workflows",
  "lists",
  "customObjects",
  "associations",
] as const;

function DiffSection({ label, diff }: { label: string; diff: ResourceDiff }) {
  const total = diff.added.length + diff.modified.length + diff.removed.length + diff.unchanged.length;
  if (total === 0) return null;

  return (
    <div className="card stack" style={{ padding: 12 }}>
      <h4 style={{ margin: 0 }}>{label}</h4>
      <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
        {diff.added.length > 0 && <span style={{ color: "var(--success)" }}>+{diff.added.length} added</span>}
        {diff.modified.length > 0 && <span style={{ color: "var(--warning)" }}>~{diff.modified.length} modified</span>}
        {diff.removed.length > 0 && <span style={{ color: "var(--danger)" }}>-{diff.removed.length} removed</span>}
        {diff.unchanged.length > 0 && <span style={{ color: "var(--muted)" }}>{diff.unchanged.length} unchanged</span>}
      </div>
      {diff.added.length > 0 && (
        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
          {diff.added.map((k) => <div key={k} style={{ color: "var(--success)" }}>+ {k}</div>)}
        </div>
      )}
      {diff.modified.length > 0 && (
        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
          {diff.modified.map((k) => <div key={k} style={{ color: "var(--warning)" }}>~ {k}</div>)}
        </div>
      )}
      {diff.removed.length > 0 && (
        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
          {diff.removed.map((k) => <div key={k} style={{ color: "var(--danger)" }}>- {k}</div>)}
        </div>
      )}
    </div>
  );
}

function DiffResults({ diff }: { diff: ConfigDiff }) {
  return (
    <div className="stack">
      <div className="card" style={{ display: "flex", gap: 24, justifyContent: "center", padding: 16 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--success)" }}>{diff.summary.totalAdded}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Added</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--warning)" }}>{diff.summary.totalModified}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Modified</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--danger)" }}>{diff.summary.totalRemoved}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Removed</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--muted)" }}>{diff.summary.totalUnchanged}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Unchanged</div>
        </div>
      </div>

      {RESOURCE_TYPES.map((type) => (
        <DiffSection
          key={type}
          label={type.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
          diff={diff[type]}
        />
      ))}
    </div>
  );
}

export default function DiffPage() {
  const { portals } = usePortal();
  const [mode, setMode] = useState<"portals" | "versions" | "template-portal">("portals");
  const [diff, setDiff] = useState<ConfigDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Portal mode
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");

  // Template version mode
  const [templateIds, setTemplateIds] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [versionA, setVersionA] = useState("");
  const [versionB, setVersionB] = useState("");

  // Template vs portal mode
  const [tvPortalVersionId, setTvPortalVersionId] = useState("");
  const [tvPortalId, setTvPortalId] = useState("");

  useEffect(() => {
    apiGet<{ ok: true; templateIds: string[] }>("/api/template-versions")
      .then((r) => setTemplateIds(r.templateIds))
      .catch(() => setTemplateIds([]));
  }, []);

  useEffect(() => {
    if (!selectedTemplate) { setVersions([]); return; }
    apiGet<{ ok: true; versions: TemplateVersion[] }>(`/api/template-versions/${encodeURIComponent(selectedTemplate)}`)
      .then((r) => setVersions(r.versions))
      .catch(() => setVersions([]));
  }, [selectedTemplate]);

  const handleComparePortals = async () => {
    if (!sourceId || !targetId) return;
    setLoading(true); setError(""); setDiff(null);
    try {
      const resp = await apiPost<{ ok: true; diff: ConfigDiff }>("/api/diff/portals", {
        sourcePortalId: sourceId,
        targetPortalId: targetId,
      });
      setDiff(resp.diff);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diff failed");
    } finally { setLoading(false); }
  };

  const handleCompareVersions = async () => {
    if (!versionA || !versionB) return;
    setLoading(true); setError(""); setDiff(null);
    try {
      const resp = await apiPost<{ ok: true; diff: ConfigDiff }>("/api/diff/templates", {
        mode: "versions",
        versionIdA: versionA,
        versionIdB: versionB,
      });
      setDiff(resp.diff);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diff failed");
    } finally { setLoading(false); }
  };

  const handleCompareTemplatePortal = async () => {
    if (!tvPortalVersionId || !tvPortalId) return;
    const version = versions.find((v) => v.id === tvPortalVersionId);
    if (!version) return;
    setLoading(true); setError(""); setDiff(null);
    try {
      const resp = await apiPost<{ ok: true; diff: ConfigDiff }>("/api/diff/templates", {
        mode: "portal",
        resources: version.resources,
        portalId: tvPortalId,
      });
      setDiff(resp.diff);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diff failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="stack">
      <h1 className="page-title">Configuration Diff</h1>
      <p className="page-subtitle">
        Compare configurations between portals, template versions, or a template against a live portal.
      </p>

      {/* Mode selector */}
      <div className="card" style={{ display: "flex", gap: 8 }}>
        {(["portals", "versions", "template-portal"] as const).map((m) => (
          <button
            key={m}
            className={mode === m ? "btn btn-primary" : "btn btn-ghost"}
            onClick={() => { setMode(m); setDiff(null); setError(""); }}
          >
            {m === "portals" ? "Portal vs Portal" : m === "versions" ? "Version vs Version" : "Template vs Portal"}
          </button>
        ))}
      </div>

      {error && <div className="card" style={{ borderLeft: "3px solid var(--danger)", color: "var(--danger)" }}>{error}</div>}

      {/* Portal vs Portal */}
      {mode === "portals" && (
        <div className="card stack">
          <h3>Compare Portals</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">Source (desired state)</label>
              <select className="input" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value="">Select source...</option>
                {portals.map((p) => (
                  <option key={p.hubId} value={p.hubId}>{p.name} ({p.hubId})</option>
                ))}
              </select>
            </div>
            <div style={{ padding: "8px 0", fontSize: 18 }}>vs</div>
            <div style={{ flex: 1 }}>
              <label className="field-label">Target (current state)</label>
              <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">Select target...</option>
                {portals.filter((p) => p.hubId !== sourceId).map((p) => (
                  <option key={p.hubId} value={p.hubId}>{p.name} ({p.hubId})</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" disabled={!sourceId || !targetId || loading} onClick={handleComparePortals}>
              {loading ? "Comparing..." : "Compare"}
            </button>
          </div>
        </div>
      )}

      {/* Version vs Version */}
      {mode === "versions" && (
        <div className="card stack">
          <h3>Compare Template Versions</h3>
          <div>
            <label className="field-label">Template</label>
            <select className="input" value={selectedTemplate} onChange={(e) => { setSelectedTemplate(e.target.value); setVersionA(""); setVersionB(""); }}>
              <option value="">Select template...</option>
              {templateIds.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          {versions.length > 0 && (
            <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
              <div style={{ flex: 1 }}>
                <label className="field-label">Version A</label>
                <select className="input" value={versionA} onChange={(e) => setVersionA(e.target.value)}>
                  <option value="">Select...</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>{v.version} — {v.description || "no description"}</option>
                  ))}
                </select>
              </div>
              <div style={{ padding: "8px 0", fontSize: 18 }}>vs</div>
              <div style={{ flex: 1 }}>
                <label className="field-label">Version B</label>
                <select className="input" value={versionB} onChange={(e) => setVersionB(e.target.value)}>
                  <option value="">Select...</option>
                  {versions.filter((v) => v.id !== versionA).map((v) => (
                    <option key={v.id} value={v.id}>{v.version} — {v.description || "no description"}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" disabled={!versionA || !versionB || loading} onClick={handleCompareVersions}>
                {loading ? "Comparing..." : "Compare"}
              </button>
            </div>
          )}
          {selectedTemplate && versions.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>No versions found for this template.</div>
          )}
        </div>
      )}

      {/* Template vs Portal */}
      {mode === "template-portal" && (
        <div className="card stack">
          <h3>Compare Template vs Live Portal</h3>
          <div>
            <label className="field-label">Template</label>
            <select className="input" value={selectedTemplate} onChange={(e) => { setSelectedTemplate(e.target.value); setTvPortalVersionId(""); }}>
              <option value="">Select template...</option>
              {templateIds.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          {versions.length > 0 && (
            <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
              <div style={{ flex: 1 }}>
                <label className="field-label">Template Version</label>
                <select className="input" value={tvPortalVersionId} onChange={(e) => setTvPortalVersionId(e.target.value)}>
                  <option value="">Select version...</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>{v.version} — {v.description || "no description"}</option>
                  ))}
                </select>
              </div>
              <div style={{ padding: "8px 0", fontSize: 18 }}>vs</div>
              <div style={{ flex: 1 }}>
                <label className="field-label">Portal</label>
                <select className="input" value={tvPortalId} onChange={(e) => setTvPortalId(e.target.value)}>
                  <option value="">Select portal...</option>
                  {portals.map((p) => (
                    <option key={p.hubId} value={p.hubId}>{p.name} ({p.hubId})</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" disabled={!tvPortalVersionId || !tvPortalId || loading} onClick={handleCompareTemplatePortal}>
                {loading ? "Comparing..." : "Compare"}
              </button>
            </div>
          )}
        </div>
      )}

      {diff && <DiffResults diff={diff} />}
    </div>
  );
}
