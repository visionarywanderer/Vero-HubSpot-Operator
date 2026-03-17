"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { usePortal } from "@/hooks/usePortal";
import { DraftsTable, type Draft } from "@/components/drafts/DraftsTable";

type Property = {
  name: string; label: string; type: string; fieldType: string; groupName?: string;
  description?: string; displayOrder?: number; hasUniqueValue?: boolean; hidden?: boolean;
  formField?: boolean; calculated?: boolean; externalOptions?: boolean; hubspotDefined?: boolean;
  createdAt?: string; updatedAt?: string; archived?: boolean;
  options?: Array<{ label: string; value: string }>; [key: string]: unknown;
};

type PropertyGroup = { name: string; label: string; displayOrder?: number };

const OBJECT_TYPES = ["contacts", "companies", "deals", "tickets", "line_items", "products", "quotes", "calls", "emails", "meetings", "notes", "tasks"];

const TYPE_FIELD_MAP: Record<string, string[]> = {
  string: ["text", "textarea", "phonenumber", "file", "html"],
  number: ["number", "calculation_equation"],
  datetime: ["date"], date: ["date"], bool: ["booleancheckbox"],
  enumeration: ["select", "radio", "checkbox"], object_coordinates: ["text"],
};

export default function PropertiesPage() {
  const { activePortal } = usePortal();
  const [objectType, setObjectType] = useState("contacts");
  const [properties, setProperties] = useState<Property[]>([]);
  const [groups, setGroups] = useState<PropertyGroup[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [filter, setFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [showBuiltIn, setShowBuiltIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState("string");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newGroup, setNewGroup] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newOptions, setNewOptions] = useState("");
  const [newHasUniqueValue, setNewHasUniqueValue] = useState(false);
  const [newHidden, setNewHidden] = useState(false);
  const [newFormField, setNewFormField] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [expandedProp, setExpandedProp] = useState<string | null>(null);
  const [specJson, setSpecJson] = useState("");
  const [showJsonInput, setShowJsonInput] = useState(false);

  const refresh = () => {
    if (!activePortal) { setProperties([]); setGroups([]); setDrafts([]); return; }
    setLoading(true);
    const q = encodeURIComponent(activePortal.id);
    Promise.all([
      apiGet<{ ok: true; properties: Property[] }>(`/api/properties?portalId=${q}&objectType=${objectType}`),
      apiGet<{ ok: true; groups: PropertyGroup[] }>(`/api/properties/groups?portalId=${q}&objectType=${objectType}`).catch(() => ({ groups: [] as PropertyGroup[] })),
    ]).then(([propResp, groupResp]) => { setProperties(propResp.properties); setGroups(groupResp.groups); })
      .catch(() => { setProperties([]); setGroups([]); }).finally(() => setLoading(false));
    apiGet<{ ok: true; drafts: Draft[] }>(`/api/properties/drafts?portalId=${q}`)
      .then((r) => setDrafts(r.drafts)).catch(() => setDrafts([]));
  };

  useEffect(() => { refresh(); }, [activePortal, objectType]);
  useEffect(() => { const v = TYPE_FIELD_MAP[newType]; if (v && !v.includes(newFieldType)) setNewFieldType(v[0]); }, [newType]);

  const filtered = properties.filter((p) => {
    if (!showBuiltIn && p.hubspotDefined) return false;
    if (groupFilter && p.groupName !== groupFilter) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.label.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
  });

  const handleCreate = async () => {
    if (!activePortal || !newName || !newLabel) return;
    setError(""); setStatus("");
    const spec: Record<string, unknown> = { name: newName, label: newLabel, type: newType, fieldType: newFieldType, description: newDescription || undefined, groupName: newGroup || undefined, hasUniqueValue: newHasUniqueValue, hidden: newHidden, formField: newFormField };
    if (newType === "enumeration" && newOptions.trim()) {
      spec.options = newOptions.split("\n").map((l) => l.trim()).filter(Boolean).map((line, i) => {
        const [label, value] = line.includes("|") ? line.split("|").map((s) => s.trim()) : [line, line.toLowerCase().replace(/\s+/g, "_")];
        return { label, value, displayOrder: i };
      });
    }
    try { await apiPost("/api/properties", { portalId: activePortal.id, objectType, spec }); setStatus(`Property "${newName}" created`); setNewName(""); setNewLabel(""); setNewDescription(""); setNewOptions(""); setNewHasUniqueValue(false); setNewHidden(false); setNewFormField(true); refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Create failed"); }
  };

  const handleCreateGroup = async () => {
    if (!activePortal || !newGroupName || !newGroupLabel) return;
    setError("");
    try { await apiPost("/api/properties/groups", { portalId: activePortal.id, objectType, spec: { name: newGroupName, label: newGroupLabel } }); setStatus(`Group "${newGroupLabel}" created`); setNewGroupName(""); setNewGroupLabel(""); setShowCreateGroup(false); refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Group create failed"); }
  };

  const handleDelete = async (name: string) => {
    if (!activePortal || !confirm(`Delete property "${name}"?`)) return;
    try { await apiDelete(`/api/properties/${objectType}/${name}?portalId=${encodeURIComponent(activePortal.id)}`); refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
  };

  const handleSaveDraft = async () => {
    if (!activePortal || !specJson.trim()) return;
    setError(""); setStatus("");
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(specJson); } catch { setError("Invalid JSON."); return; }
    try { await apiPost("/api/properties/drafts", { portalId: activePortal.id, spec: { ...parsed, objectType } }); setStatus("Draft saved."); setSpecJson(""); refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to save draft"); }
  };

  const handleDeployDraft = async (draft: Draft) => {
    if (!activePortal) return;
    setError(""); setStatus("");
    const ot = String(draft.spec.objectType || objectType);
    await apiPost("/api/properties", { portalId: activePortal.id, objectType: ot, spec: draft.spec });
    setStatus(`"${draft.name}" created.`); await apiDelete(`/api/properties/drafts/${draft.id}?portalId=${encodeURIComponent(activePortal.id)}`); refresh();
  };

  const handleDeleteDraft = async (draft: Draft) => { if (!activePortal) return; await apiDelete(`/api/properties/drafts/${draft.id}?portalId=${encodeURIComponent(activePortal.id)}`); refresh(); };

  const customCount = properties.filter((p) => !p.hubspotDefined).length;
  const builtInCount = properties.filter((p) => p.hubspotDefined).length;

  return (
    <div className="stack">
      <h1 className="page-title">Properties</h1>

      <DraftsTable
        drafts={drafts}
        portalId={activePortal?.id}
        onDeploy={handleDeployDraft}
        onDelete={handleDeleteDraft}
        onEdit={(d) => { setSpecJson(JSON.stringify(d.spec, null, 2)); setShowJsonInput(true); }}
        deployLabel="Create"
        typeLabel={(spec) => `${spec.objectType || "—"} / ${spec.type || "—"}`}
      />

      <div className="card" style={{ display: "flex", gap: 24, fontSize: 13 }}>
        <div><strong>{properties.length}</strong> total</div>
        <div><strong>{customCount}</strong> custom</div>
        <div><strong>{builtInCount}</strong> built-in</div>
        <div><strong>{groups.length}</strong> groups</div>
      </div>

      <div className="card" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select className="input" style={{ width: "auto" }} value={objectType} onChange={(e) => setObjectType(e.target.value)}>
          {OBJECT_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <select className="input" style={{ width: "auto" }} value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
          <option value="">All Groups</option>
          {groups.map((g) => <option key={g.name} value={g.name}>{g.label}</option>)}
        </select>
        <input className="input" style={{ flex: 1, minWidth: 150 }} placeholder="Filter by name, label, or description..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={showBuiltIn} onChange={(e) => setShowBuiltIn(e.target.checked)} /> Show built-in
        </label>
        <button className="btn" onClick={() => { setShowJsonInput(!showJsonInput); setShowCreate(false); setShowCreateGroup(false); }}>
          {showJsonInput ? "Cancel JSON" : "From JSON"}
        </button>
        <button className="btn btn-primary" onClick={() => { setShowCreate(!showCreate); setShowCreateGroup(false); setShowJsonInput(false); }}>
          {showCreate ? "Cancel" : "Create Property"}
        </button>
        <button className="btn btn-ghost" onClick={() => { setShowCreateGroup(!showCreateGroup); setShowCreate(false); setShowJsonInput(false); }}>
          {showCreateGroup ? "Cancel" : "Create Group"}
        </button>
      </div>

      {error && <div className="card" style={{ borderLeft: "3px solid var(--danger)", color: "var(--danger)" }}>{error}</div>}
      {status && <div className="card" style={{ borderLeft: "3px solid var(--success)" }}>{status}</div>}

      {showJsonInput && (
        <div className="card stack">
          <h3>Property from JSON</h3>
          <textarea className="textarea" rows={8} placeholder="Paste property JSON spec..." value={specJson} onChange={(e) => setSpecJson(e.target.value)} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" disabled={!activePortal || !specJson.trim()} onClick={handleSaveDraft}>Save Draft</button>
            <button className="btn btn-danger" disabled={!activePortal || !specJson.trim()} onClick={async () => {
              if (!activePortal || !specJson.trim()) return;
              let parsed: Record<string, unknown>;
              try { parsed = JSON.parse(specJson); } catch { setError("Invalid JSON."); return; }
              try { await apiPost("/api/properties", { portalId: activePortal.id, objectType, spec: parsed }); setStatus("Property created."); setSpecJson(""); setShowJsonInput(false); refresh(); }
              catch (err) { setError(err instanceof Error ? err.message : "Create failed"); }
            }}>Create Now</button>
          </div>
        </div>
      )}

      {showCreateGroup && (
        <div className="card stack">
          <h3>Create Property Group</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label className="field-label">Internal Name</label><input className="input" placeholder="lowercase_snake_case" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} /></div>
            <div><label className="field-label">Display Label</label><input className="input" placeholder="Group Label" value={newGroupLabel} onChange={(e) => setNewGroupLabel(e.target.value)} /></div>
          </div>
          <button className="btn btn-primary" disabled={!newGroupName || !newGroupLabel} onClick={handleCreateGroup} style={{ width: "fit-content" }}>Create Group</button>
        </div>
      )}

      {showCreate && (
        <div className="card stack">
          <h3>Create Property</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label className="field-label">Internal Name</label><input className="input" placeholder="lowercase_snake_case" value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
            <div><label className="field-label">Label</label><input className="input" placeholder="Display Label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} /></div>
            <div><label className="field-label">Type</label><select className="input" value={newType} onChange={(e) => setNewType(e.target.value)}>{Object.keys(TYPE_FIELD_MAP).map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="field-label">Field Type</label><select className="input" value={newFieldType} onChange={(e) => setNewFieldType(e.target.value)}>{(TYPE_FIELD_MAP[newType] || []).map((ft) => <option key={ft} value={ft}>{ft}</option>)}</select></div>
            <div><label className="field-label">Group</label><select className="input" value={newGroup} onChange={(e) => setNewGroup(e.target.value)}><option value="">Default</option>{groups.map((g) => <option key={g.name} value={g.name}>{g.label}</option>)}</select></div>
            <div><label className="field-label">Description</label><input className="input" placeholder="Optional description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} /></div>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><input type="checkbox" checked={newHasUniqueValue} onChange={(e) => setNewHasUniqueValue(e.target.checked)} /> Unique value</label>
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><input type="checkbox" checked={newFormField} onChange={(e) => setNewFormField(e.target.checked)} /> Show in forms</label>
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><input type="checkbox" checked={newHidden} onChange={(e) => setNewHidden(e.target.checked)} /> Hidden</label>
          </div>
          {newType === "enumeration" && (
            <div><label className="field-label">Options (one per line, or Label|value)</label><textarea className="textarea" rows={4} placeholder={"Option A\nOption B|option_b\nOption C"} value={newOptions} onChange={(e) => setNewOptions(e.target.value)} /></div>
          )}
          <button className="btn btn-primary" disabled={!newName || !newLabel} onClick={handleCreate} style={{ width: "fit-content" }}>Create</button>
        </div>
      )}

      <div className="card">
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{loading ? "Loading..." : `${filtered.length} properties${!showBuiltIn ? " (custom only)" : ""}${groupFilter ? ` in ${groupFilter}` : ""}`}</div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th></th><th>Name</th><th>Label</th><th>Type</th><th>Field</th><th>Group</th><th>Custom</th><th></th></tr></thead>
            <tbody>
              {filtered.slice(0, 200).map((p) => {
                const isExpanded = expandedProp === p.name;
                return (
                  <tr key={p.name} style={{ cursor: "pointer" }} onClick={() => setExpandedProp(isExpanded ? null : p.name)}>
                    <td style={{ fontSize: 10, width: 16, textAlign: "center", color: "var(--muted)" }}>{isExpanded ? "▼" : "▶"}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{p.name}</td>
                    <td>{p.label}</td><td style={{ fontSize: 12 }}>{p.type}</td><td style={{ fontSize: 12 }}>{p.fieldType}</td>
                    <td style={{ fontSize: 11, color: "var(--muted)" }}>{p.groupName || "—"}</td><td style={{ fontSize: 12 }}>{p.hubspotDefined ? "No" : "Yes"}</td>
                    <td>{!p.hubspotDefined && <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={(e) => { e.stopPropagation(); handleDelete(p.name); }}>Delete</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {expandedProp && (() => {
            const p = properties.find((prop) => prop.name === expandedProp);
            if (!p) return null;
            return (
              <div className="card" style={{ margin: "8px 0", padding: 12, fontSize: 12, background: "var(--bg-raised)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div><strong>Description:</strong> {p.description || "—"}</div><div><strong>Display Order:</strong> {p.displayOrder ?? "—"}</div>
                  <div><strong>Unique Value:</strong> {p.hasUniqueValue ? "Yes" : "No"}</div><div><strong>Hidden:</strong> {p.hidden ? "Yes" : "No"}</div>
                  <div><strong>Form Field:</strong> {p.formField ? "Yes" : "No"}</div><div><strong>Calculated:</strong> {p.calculated ? "Yes" : "No"}</div>
                  <div><strong>External Options:</strong> {p.externalOptions ? "Yes" : "No"}</div>
                  <div><strong>Created:</strong> {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}</div>
                  <div><strong>Updated:</strong> {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "—"}</div>
                </div>
                {Array.isArray(p.options) && p.options.length > 0 && (
                  <div style={{ marginTop: 8 }}><strong>Options:</strong>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {p.options.map((opt) => (<span key={opt.value} style={{ padding: "2px 6px", borderRadius: 3, background: "var(--bg, #fff)", border: "1px solid var(--line)", fontSize: 11 }}>{opt.label} <span style={{ color: "var(--muted)" }}>({opt.value})</span></span>))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          {filtered.length > 200 && <div style={{ padding: 8, fontSize: 12, color: "var(--muted)" }}>Showing first 200 of {filtered.length} properties. Use the filter to narrow results.</div>}
        </div>
      </div>
    </div>
  );
}
