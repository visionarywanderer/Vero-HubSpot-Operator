"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";

export type Draft = {
  id: string;
  name: string;
  spec: Record<string, unknown>;
  createdAt: string;
};

interface DraftsTableProps {
  drafts: Draft[];
  portalId?: string;
  onDeploy: (draft: Draft) => Promise<void>;
  onDelete: (draft: Draft) => Promise<void>;
  onEdit?: (draft: Draft) => void;
  deployLabel?: string;
  typeLabel?: (spec: Record<string, unknown>) => string;
}

export function DraftsTable({ drafts, portalId, onDeploy, onDelete, onEdit, deployLabel = "Deploy", typeLabel }: DraftsTableProps) {
  const [deploying, setDeploying] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [needsValidation, setNeedsValidation] = useState(false);
  const [validating, setValidating] = useState(false);
  const [viewingSpec, setViewingSpec] = useState<Draft | null>(null);

  if (drafts.length === 0) return null;

  const handleValidateSession = async () => {
    if (!portalId) return;
    setValidating(true);
    setError("");
    try {
      const resp = await apiGet<{ ok: boolean; valid: boolean }>(`/api/portals/${portalId}/validate`);
      if (resp.valid) {
        setNeedsValidation(false);
        setError("");
      } else {
        setError("Token validation failed. Try reconnecting the portal.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setValidating(false);
    }
  };

  return (
    <>
      <div className="card stack">
        <h3>Saved Drafts</h3>
        <p className="page-subtitle">
          Saved locally. Deploy to HubSpot when ready.
        </p>
        {error && (
          <div style={{ fontSize: 13, color: "var(--danger)", padding: "8px 12px", background: "rgba(220,50,50,0.06)", borderRadius: 6 }}>
            {error}
            {needsValidation && portalId && (
              <div style={{ marginTop: 8 }}>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 12, padding: "4px 12px" }}
                  disabled={validating}
                  onClick={handleValidateSession}
                >
                  {validating ? "Validating..." : "Validate Session"}
                </button>
                <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>
                  Validates your HubSpot token to unlock writes on production portals.
                </span>
              </div>
            )}
          </div>
        )}
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              {typeLabel && <th>Type</th>}
              <th>Saved</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(drafts ?? []).map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                {typeLabel && <td style={{ fontSize: 12 }}>{typeLabel(d.spec)}</td>}
                <td style={{ fontSize: 12 }}>{new Date(d.createdAt).toLocaleString()}</td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                      disabled={deploying === d.id}
                      onClick={async () => {
                        setDeploying(d.id);
                        setError("");
                        setNeedsValidation(false);
                        try {
                          await onDeploy(d);
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : "Deploy failed";
                          setError(msg);
                          if (msg.toLowerCase().includes("sandbox") || msg.toLowerCase().includes("first session") || msg.toLowerCase().includes("read-only")) {
                            setNeedsValidation(true);
                          }
                        } finally {
                          setDeploying(null);
                        }
                      }}
                    >
                      {deploying === d.id ? "Deploying..." : deployLabel}
                    </button>
                    <button
                      className="btn"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                      onClick={() => setViewingSpec(viewingSpec?.id === d.id ? null : d)}
                    >
                      View
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                      onClick={() => onDelete(d)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {viewingSpec && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <strong style={{ fontSize: 13 }}>Spec: {viewingSpec.name}</strong>
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setViewingSpec(null)}>Close</button>
            </div>
            <pre style={{
              fontFamily: "var(--font-mono)", fontSize: 11, whiteSpace: "pre-wrap",
              background: "var(--bg-raised, #f5f5f5)", padding: 12, borderRadius: 6,
              maxHeight: 300, overflow: "auto", margin: 0,
            }}>
              {JSON.stringify(viewingSpec.spec, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </>
  );
}
