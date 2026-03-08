"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { usePortal } from "@/hooks/usePortal";

export default function PropertiesPage() {
  const { activePortal } = usePortal();
  const [objectType, setObjectType] = useState("contacts");
  const [properties, setProperties] = useState<Array<Record<string, unknown>>>([]);
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!activePortal) {
      setProperties([]);
      return;
    }

    apiGet<{ ok: true; properties: Array<Record<string, unknown>> }>(
      `/api/properties?portalId=${encodeURIComponent(activePortal.id)}&objectType=${objectType}`
    )
      .then((r) => setProperties(r.properties))
      .catch(() => setProperties([]));
  }, [activePortal, objectType]);

  return (
    <div className="stack">
      <h1 className="page-title">Properties</h1>
      <div className="card stack">
        <div style={{ display: "flex", gap: 8 }}>
          <select className="select" value={objectType} onChange={(e) => setObjectType(e.target.value)}>
            <option value="contacts">Contacts</option>
            <option value="companies">Companies</option>
            <option value="deals">Deals</option>
            <option value="tickets">Tickets</option>
          </select>
        </div>
        <table className="table">
          <thead><tr><th>Internal Name</th><th>Label</th><th>Type</th></tr></thead>
          <tbody>
            {properties.slice(0, 50).map((p, i) => (
              <tr key={i}><td>{String(p.name || "")}</td><td>{String(p.label || "")}</td><td>{String(p.type || "")}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card stack">
        <h3>Create Property</h3>
        <input className="input" placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn btn-primary" disabled={!activePortal} onClick={async () => {
          if (!activePortal) return;
          await apiPost("/api/properties", {
            portalId: activePortal.id,
            objectType,
            spec: { name, label, type: "string", fieldType: "text", groupName: "contactinformation" }
          });
        }}>Create</button>
      </div>
    </div>
  );
}
