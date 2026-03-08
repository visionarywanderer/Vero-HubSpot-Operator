"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { usePortal } from "@/hooks/usePortal";

export default function ListsPage() {
  const { activePortal } = usePortal();
  const [lists, setLists] = useState<Array<Record<string, unknown>>>([]);
  const [name, setName] = useState("Hot Leads - Active MQLs");

  useEffect(() => {
    if (!activePortal) {
      setLists([]);
      return;
    }

    apiGet<{ ok: true; lists: Array<Record<string, unknown>> }>(`/api/lists?portalId=${encodeURIComponent(activePortal.id)}`)
      .then((r) => setLists(r.lists))
      .catch(() => setLists([]));
  }, [activePortal]);

  return (
    <div className="stack">
      <h1 className="page-title">Lists & Segments</h1>
      <div className="card stack">
        <h3>Existing Lists</h3>
        <table className="table">
          <thead><tr><th>Name</th><th>Type</th><th>Size</th></tr></thead>
          <tbody>
            {lists.map((item, i) => (
              <tr key={i}><td>{String(item.name || "")}</td><td>{String(item.processingType || "")}</td><td>{String(item.size || "-")}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card stack">
        <h3>Create List</h3>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary" disabled={!activePortal} onClick={async () => {
          if (!activePortal) return;
          await apiPost("/api/lists", {
            portalId: activePortal.id,
            spec: { name, objectTypeId: "0-1", processingType: "DYNAMIC", filterBranch: { filterBranchType: "OR", filterBranches: [] } }
          });
        }}>Create List</button>
      </div>
    </div>
  );
}
