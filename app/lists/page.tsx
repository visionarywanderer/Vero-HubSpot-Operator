"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { usePortal } from "@/hooks/usePortal";
import { DraftsTable, type Draft } from "@/components/drafts/DraftsTable";

type ListSummary = {
  listId?: string; id?: string; name?: string; processingType?: string;
  objectTypeId?: string; size?: number; createdAt?: string; updatedAt?: string;
  [key: string]: unknown;
};

const OBJECT_TYPE_LABELS: Record<string, string> = {
  "0-1": "Contacts", "0-2": "Companies", "0-3": "Deals", "0-5": "Tickets", "0-48": "Custom Objects",
};

export default function ListsPage() {
  const { activePortal } = usePortal();
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "DYNAMIC" | "MANUAL">("all");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newObjectTypeId, setNewObjectTypeId] = useState("0-1");
  const [newProcessingType, setNewProcessingType] = useState<"DYNAMIC" | "MANUAL">("DYNAMIC");
  const [newFilterJson, setNewFilterJson] = useState("");
  const [specJson, setSpecJson] = useState("");
  const [showJsonInput, setShowJsonInput] = useState(false);

  const refresh = useCallback(() => {
    if (!activePortal) { setLists([]); setDrafts([]); return; }
    setLoading(true);
    const q = encodeURIComponent(activePortal.id);
    apiGet<{ ok: true; lists: ListSummary[] }>(`/api/lists?portalId=${q}`)
      .then((r) => setLists(r.lists)).catch(() => setLists([])).finally(() => setLoading(false));
    apiGet<{ ok: true; drafts: Draft[] }>(`/api/lists/drafts?portalId=${q}`)
      .then((r) => setDrafts(r.drafts)).catch(() => setDrafts([]));
  }, [activePortal]);

  useEffect(() => { refresh(); }, [refresh]);

  const listId = (l: ListSummary) => String(l.listId ?? l.id ?? "");

  const filtered = lists.filter((l) => {
    if (typeFilter !== "all" && l.processingType !== typeFilter) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (l.name || "").toLowerCase().includes(q) || listId(l).includes(q);
  });

  const handleCreate = async () => {
    if (!activePortal || !newName.trim()) return;
    setError(""); setStatus("");
    const spec: Record<string, unknown> = { name: newName.trim(), objectTypeId: newObjectTypeId, processingType: newProcessingType };
    if (newProcessingType === "DYNAMIC" && newFilterJson.trim()) {
      try { spec.filterBranch = JSON.parse(newFilterJson); } catch { setError("Invalid filter JSON."); return; }
    }
    try { await apiPost("/api/lists", { portalId: activePortal.id, spec }); setStatus(`List "${newName}" created.`); setNewName(""); setNewFilterJson(""); setShowCreate(false); refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Create failed"); }
  };

  const handleDelete = async (id: string) => {
    if (!activePortal) return; setError("");
    try { await apiDelete(`/api/lists/${id}?portalId=${encodeURIComponent(activePortal.id)}`); setStatus("List deleted."); refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
  };

  const handleSaveDraft = async () => {
    if (!activePortal || !specJson.trim()) return;
    setError(""); setStatus("");
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(specJson); } catch { setError("Invalid JSON."); return; }
    try { await apiPost("/api/lists/drafts", { portalId: activePortal.id, spec: parsed }); setStatus("Draft saved."); setSpecJson(""); refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to save draft"); }
  };

  const handleDeployDraft = async (draft: Draft) => {
    if (!activePortal) return;
    setError(""); setStatus("");
    await apiPost("/api/lists", { portalId: activePortal.id, spec: draft.spec });
    setStatus(`"${draft.name}" created.`); await apiDelete(`/api/lists/drafts/${draft.id}?portalId=${encodeURIComponent(activePortal.id)}`); refresh();
  };

  const handleDeleteDraft = async (draft: Draft) => { if (!activePortal) return; await apiDelete(`/api/lists/drafts/${draft.id}?portalId=${encodeURIComponent(activePortal.id)}`); refresh(); };

  const dynamicCount = lists.filter((l) => l.processingType === "DYNAMIC").length;
  const manualCount = lists.filter((l) => l.processingType === "MANUAL").length;

  return (
    <div className="stack">
      <h1 className="page-title">Lists & Segments</h1>

      <DraftsTable
        drafts={drafts}
        portalId={activePortal?.id}
        onDeploy={handleDeployDraft}
        onDelete={handleDeleteDraft}
        onEdit={(d) => { setSpecJson(JSON.stringify(d.spec, null, 2)); setShowJsonInput(true); }}
        deployLabel="Create"
        typeLabel={(spec) => `${OBJECT_TYPE_LABELS[String(spec.objectTypeId)] || spec.objectTypeId || "—"} / ${spec.processingType || "—"}`}
      />

      <div className="card" style={{ display: "flex", gap: 24, fontSize: 13 }}>
        <div><strong>{lists.length}</strong> total lists</div>
        <div><strong>{dynamicCount}</strong> dynamic</div>
        <div><strong>{manualCount}</strong> manual</div>
      </div>

      <div className="card" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input className="input" style={{ flex: 1, minWidth: 150 }} placeholder="Filter by name or ID..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        <select className="input" style={{ width: "auto" }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | "DYNAMIC" | "MANUAL")}>
          <option value="all">All Types</option><option value="DYNAMIC">Dynamic</option><option value="MANUAL">Manual</option>
        </select>
        <button className="btn" onClick={() => { setShowJsonInput(!showJsonInput); setShowCreate(false); }}>
          {showJsonInput ? "Cancel JSON" : "From JSON"}
        </button>
        <button className="btn btn-primary" onClick={() => { setShowCreate(!showCreate); setShowJsonInput(false); }}>
          {showCreate ? "Cancel" : "Create List"}
        </button>
      </div>

      {error && <div className="card" style={{ borderLeft: "3px solid var(--danger)", color: "var(--danger)" }}>{error}</div>}
      {status && <div className="card" style={{ borderLeft: "3px solid var(--success)" }}>{status}</div>}

      {showJsonInput && (
        <div className="card stack">
          <h3>List from JSON</h3>
          <textarea className="textarea" rows={8} placeholder="Paste list JSON spec..." value={specJson} onChange={(e) => setSpecJson(e.target.value)} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" disabled={!activePortal || !specJson.trim()} onClick={handleSaveDraft}>Save Draft</button>
            <button className="btn btn-danger" disabled={!activePortal || !specJson.trim()} onClick={async () => {
              if (!activePortal || !specJson.trim()) return;
              let parsed: Record<string, unknown>;
              try { parsed = JSON.parse(specJson); } catch { setError("Invalid JSON."); return; }
              try { await apiPost("/api/lists", { portalId: activePortal.id, spec: parsed }); setStatus("List created."); setSpecJson(""); setShowJsonInput(false); refresh(); }
              catch (err) { setError(err instanceof Error ? err.message : "Create failed"); }
            }}>Create Now</button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="card stack">
          <h3>Create List</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label className="field-label">List Name</label><input className="input" placeholder="e.g. Hot Leads - Active MQLs" value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
            <div><label className="field-label">Object Type</label><select className="input" value={newObjectTypeId} onChange={(e) => setNewObjectTypeId(e.target.value)}>{Object.entries(OBJECT_TYPE_LABELS).map(([id, label]) => <option key={id} value={id}>{label} ({id})</option>)}</select></div>
            <div><label className="field-label">Processing Type</label><select className="input" value={newProcessingType} onChange={(e) => setNewProcessingType(e.target.value as "DYNAMIC" | "MANUAL")}><option value="DYNAMIC">Dynamic (auto-updated)</option><option value="MANUAL">Manual (static)</option></select></div>
          </div>
          {newProcessingType === "DYNAMIC" && (
            <div>
              <label className="field-label">Filter Branch JSON (optional)</label>
              <textarea className="textarea" rows={5} placeholder={'{\n  "filterBranchType": "OR",\n  "filterBranches": [],\n  "filters": []\n}'} value={newFilterJson} onChange={(e) => setNewFilterJson(e.target.value)} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Leave empty to create with no filters.</div>
            </div>
          )}
          <button className="btn btn-primary" disabled={!newName.trim()} onClick={handleCreate} style={{ width: "fit-content" }}>Create</button>
        </div>
      )}

      <div className="card">
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{loading ? "Loading..." : `${filtered.length} list(s)${typeFilter !== "all" ? ` (${typeFilter.toLowerCase()})` : ""}`}</div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Name</th><th>Type</th><th>Object</th><th>Size</th><th>List ID</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              {filtered.slice(0, 100).map((l) => {
                const id = listId(l);
                return (
                  <tr key={id || l.name}>
                    <td style={{ fontWeight: 500 }}>{l.name || "—"}</td>
                    <td><span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 3, background: l.processingType === "DYNAMIC" ? "var(--info-bg)" : "rgba(128, 122, 110, 0.1)", color: l.processingType === "DYNAMIC" ? "var(--info)" : "var(--muted)" }}>{l.processingType || "—"}</span></td>
                    <td style={{ fontSize: 12 }}>{OBJECT_TYPE_LABELS[String(l.objectTypeId)] || String(l.objectTypeId || "—")}</td>
                    <td style={{ fontSize: 12, fontWeight: 500 }}>{l.size != null ? Number(l.size).toLocaleString() : "—"}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>{id || "—"}</td>
                    <td style={{ fontSize: 11, color: "var(--muted)" }}>{l.updatedAt ? new Date(String(l.updatedAt)).toLocaleDateString() : "—"}</td>
                    <td><button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => { if (confirm(`Delete list "${l.name}"?`)) handleDelete(id); }}>Delete</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > 100 && <div style={{ padding: 8, fontSize: 12, color: "var(--muted)" }}>Showing first 100 of {filtered.length} lists.</div>}
        </div>
      </div>
    </div>
  );
}
