"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { usePortal } from "@/hooks/usePortal";

type Environment = {
  name: string;
  portal_id: string;
  label: string;
  role: "development" | "staging" | "production";
  created_at: string;
  updated_at: string;
};

type PromotionResult = {
  sourceEnv: string;
  targetEnv: string;
  report: { status: string; results: Array<{ key: string; type: string; status: string }> };
  warnings: string[];
};

type DeployResult = {
  status: string;
  results: Array<{ key: string; type: string; status: string }>;
};

type TemplateVersion = {
  id: string;
  templateId: string;
  version: string;
  description: string;
  resources: unknown;
  createdAt: string;
};

const ROLE_COLORS: Record<string, string> = {
  development: "var(--info)",
  staging: "var(--warning)",
  production: "var(--danger)",
};

export default function EnvironmentsPage() {
  const { portals } = usePortal();
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  // Add form
  const [newName, setNewName] = useState("");
  const [newPortalId, setNewPortalId] = useState("");
  const [newRole, setNewRole] = useState<"development" | "staging" | "production">("development");
  const [newLabel, setNewLabel] = useState("");

  // Promotion
  const [promoteSource, setPromoteSource] = useState("");
  const [promoteTarget, setPromoteTarget] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [promotionResult, setPromotionResult] = useState<PromotionResult | null>(null);

  // Deploy
  const [templateIds, setTemplateIds] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [deployTarget, setDeployTarget] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);

  const refresh = async () => {
    try {
      const resp = await apiGet<{ ok: true; environments: Environment[] }>("/api/environments");
      setEnvironments(resp.environments);
    } catch {
      setError("Failed to load environments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
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

  const handleAdd = async () => {
    if (!newName || !newPortalId || !newRole) return;
    setError("");
    try {
      await apiPost("/api/environments", {
        name: newName,
        portalId: newPortalId,
        role: newRole,
        label: newLabel || newName,
      });
      setNewName("");
      setNewPortalId("");
      setNewLabel("");
      await refresh();
      setStatus("Environment registered");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add environment");
    }
  };

  const handleRemove = async (name: string) => {
    if (!confirm(`Remove environment "${name}"?`)) return;
    try {
      await apiDelete(`/api/environments?name=${encodeURIComponent(name)}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    }
  };

  const handlePromote = async (dryRun: boolean) => {
    if (!promoteSource || !promoteTarget) return;
    setPromoting(true);
    setError("");
    setPromotionResult(null);
    try {
      const resp = await apiPost<{ ok: true; result: PromotionResult }>("/api/environments/promote", {
        sourceEnv: promoteSource,
        targetEnv: promoteTarget,
        dryRun,
      });
      setPromotionResult(resp.result);
      setStatus(dryRun ? "Dry-run promotion complete" : "Promotion executed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Promotion failed");
    } finally {
      setPromoting(false);
    }
  };

  const handleDeploy = async (dryRun: boolean) => {
    if (!selectedVersionId || !deployTarget) return;
    const version = versions.find((v) => v.id === selectedVersionId);
    if (!version) return;
    setDeploying(true);
    setError("");
    setDeployResult(null);
    try {
      const resp = await apiPost<{ ok: true; result: DeployResult }>("/api/environments/deploy", {
        environment: deployTarget,
        resources: version.resources,
        dryRun,
        templateId: version.templateId,
        templateVersion: version.version,
      });
      setDeployResult(resp.result);
      setStatus(dryRun ? "Dry-run deployment complete" : "Deployment executed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deployment failed");
    } finally {
      setDeploying(false);
    }
  };

  if (loading) return <div className="stack"><h1 className="page-title">Environments</h1><p>Loading...</p></div>;

  return (
    <div className="stack">
      <h1 className="page-title">Environment Manager</h1>
      <p className="page-subtitle">Map portals to dev/staging/production roles. Promote or deploy configurations.</p>

      {error && <div className="card" style={{ borderLeft: "3px solid var(--danger)", color: "var(--danger)" }}>{error}</div>}
      {status && <div className="card" style={{ borderLeft: "3px solid var(--success)" }}>{status}</div>}

      {/* Current Environments */}
      <div className="card stack">
        <h3>Registered Environments</h3>
        {environments.length === 0 ? (
          <p className="page-subtitle">No environments registered yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Portal</th>
                <th>Label</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {environments.map((env) => (
                <tr key={env.name}>
                  <td style={{ fontWeight: 500 }}>{env.name}</td>
                  <td>
                    <span style={{
                      background: ROLE_COLORS[env.role] || "#888",
                      color: "#fff",
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                    }}>
                      {env.role}
                    </span>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{env.portal_id}</td>
                  <td>{env.label}</td>
                  <td>
                    <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => handleRemove(env.name)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Environment */}
      <div className="card stack">
        <h3>Register Environment</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
          <div>
            <label className="field-label">Name</label>
            <input className="input" placeholder="e.g. dev" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Portal</label>
            <select className="input" value={newPortalId} onChange={(e) => setNewPortalId(e.target.value)}>
              <option value="">Select portal...</option>
              {portals.map((p) => (
                <option key={p.hubId} value={p.hubId}>{p.name} ({p.hubId})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Role</label>
            <select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value as typeof newRole)}>
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div>
            <label className="field-label">Label</label>
            <input className="input" placeholder="Optional label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" disabled={!newName || !newPortalId} onClick={handleAdd} style={{ width: "fit-content" }}>
          Register
        </button>
      </div>

      {/* Deploy Template to Environment */}
      {environments.length > 0 && templateIds.length > 0 && (
        <div className="card stack">
          <h3>Deploy Template to Environment</h3>
          <p className="page-subtitle">Select a template version and deploy it to a registered environment.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div>
              <label className="field-label">Template</label>
              <select className="input" value={selectedTemplate} onChange={(e) => { setSelectedTemplate(e.target.value); setSelectedVersionId(""); }}>
                <option value="">Select template...</option>
                {templateIds.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Version</label>
              <select className="input" value={selectedVersionId} onChange={(e) => setSelectedVersionId(e.target.value)} disabled={!selectedTemplate}>
                <option value="">Select version...</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>{v.version} — {v.description || "no description"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Target Environment</label>
              <select className="input" value={deployTarget} onChange={(e) => setDeployTarget(e.target.value)}>
                <option value="">Select environment...</option>
                {environments.map((e) => (
                  <option key={e.name} value={e.name}>{e.label} ({e.role})</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" disabled={!selectedVersionId || !deployTarget || deploying} onClick={() => handleDeploy(true)}>
              {deploying ? "Running..." : "Dry-Run"}
            </button>
            <button className="btn btn-danger" disabled={!selectedVersionId || !deployTarget || deploying} onClick={() => handleDeploy(false)}>
              Deploy
            </button>
          </div>

          {deployResult && (
            <div className="stack" style={{ marginTop: 8 }}>
              <div style={{ fontSize: 13 }}>
                Status: <strong>{deployResult.status}</strong> |
                Resources: {deployResult.results.length}
              </div>
              {deployResult.results.length > 0 && (
                <table className="table">
                  <thead><tr><th>Resource</th><th>Type</th><th>Status</th></tr></thead>
                  <tbody>
                    {deployResult.results.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{r.key}</td>
                        <td style={{ fontSize: 12 }}>{r.type}</td>
                        <td style={{ fontSize: 12, color: r.status === "success" ? "var(--success)" : r.status === "error" ? "var(--danger)" : "var(--muted)" }}>
                          {r.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Promote */}
      {environments.length >= 2 && (
        <div className="card stack">
          <h3>Promote Configuration</h3>
          <p className="page-subtitle">Extract configuration from one environment and deploy it to another.</p>
          <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
            <div>
              <label className="field-label">Source</label>
              <select className="input" value={promoteSource} onChange={(e) => setPromoteSource(e.target.value)}>
                <option value="">Select source...</option>
                {environments.map((e) => (
                  <option key={e.name} value={e.name}>{e.label} ({e.role})</option>
                ))}
              </select>
            </div>
            <div style={{ padding: "8px 0", fontSize: 18 }}>→</div>
            <div>
              <label className="field-label">Target</label>
              <select className="input" value={promoteTarget} onChange={(e) => setPromoteTarget(e.target.value)}>
                <option value="">Select target...</option>
                {environments.filter((e) => e.name !== promoteSource).map((e) => (
                  <option key={e.name} value={e.name}>{e.label} ({e.role})</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" disabled={!promoteSource || !promoteTarget || promoting} onClick={() => handlePromote(true)}>
              {promoting ? "Running..." : "Dry-Run"}
            </button>
            <button className="btn btn-danger" disabled={!promoteSource || !promoteTarget || promoting} onClick={() => handlePromote(false)}>
              Execute
            </button>
          </div>

          {promotionResult && (
            <div className="stack" style={{ marginTop: 12 }}>
              {promotionResult.warnings.map((w, i) => (
                <div key={i} className="card" style={{ borderLeft: "3px solid var(--warning)", fontSize: 13 }}>{w}</div>
              ))}
              <div style={{ fontSize: 13 }}>
                Status: <strong>{promotionResult.report.status}</strong> |
                Resources: {promotionResult.report.results.length}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
