"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { usePortal } from "@/hooks/usePortal";

export default function PipelinesPage() {
  const { activePortal } = usePortal();
  const [objectType, setObjectType] = useState("deals");
  const [pipelines, setPipelines] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!activePortal) {
      setPipelines([]);
      return;
    }

    apiGet<{ ok: true; pipelines: Array<Record<string, unknown>> }>(
      `/api/pipelines?portalId=${encodeURIComponent(activePortal.id)}&objectType=${objectType}`
    )
      .then((r) => setPipelines(r.pipelines))
      .catch(() => setPipelines([]));
  }, [activePortal, objectType]);

  return (
    <div className="stack">
      <h1 className="page-title">Pipelines</h1>
      <div className="card stack">
        <select className="select" value={objectType} onChange={(e) => setObjectType(e.target.value)}>
          <option value="deals">Deals</option>
          <option value="tickets">Tickets</option>
        </select>
        <table className="table">
          <thead><tr><th>Name</th><th>ID</th><th>Stages</th></tr></thead>
          <tbody>
            {pipelines.map((p, i) => (
              <tr key={i}><td>{String(p.label || p.name || "")}</td><td>{String(p.id || "")}</td><td>{Array.isArray(p.stages) ? p.stages.length : "-"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
