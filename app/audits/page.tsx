"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api";
import { usePortal } from "@/hooks/usePortal";

const AUDITS = [
  { id: "audit-data-quality", title: "Data Quality", summary: "Check missing fields and fill-rate risks." },
  { id: "audit-pipeline-health", title: "Pipeline Health", summary: "Analyze stage bottlenecks and stuck deals." },
  { id: "audit-owner-distribution", title: "Owner Distribution", summary: "Review workload balance by owner." },
  { id: "audit-association-gaps", title: "Association Gaps", summary: "Find orphan records and missing links." },
  { id: "audit-lifecycle-accuracy", title: "Lifecycle Accuracy", summary: "Detect lifecycle stage mismatches." },
  { id: "audit-property-usage", title: "Property Usage", summary: "Identify low-value and duplicate fields." }
];

export default function AuditsPage() {
  const { activePortal } = usePortal();
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  return (
    <div className="stack">
      <h1 className="page-title">Portal Audits</h1>
      <p className="page-subtitle">Run comprehensive audits on the active portal.</p>
      <div className="card-grid two">
        {AUDITS.map((audit) => (
          <div key={audit.id} className="card stack">
            <h3>{audit.title}</h3>
            <p className="page-subtitle">{audit.summary}</p>
            <div className="page-subtitle">Last run: {results[audit.id] ? "just now" : "never"}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-primary"
                disabled={running === audit.id || !activePortal}
                onClick={async () => {
                  if (!activePortal) return;
                  setRunning(audit.id);
                  try {
                    await apiPost("/api/prompts/execute", { id: audit.id, portalId: activePortal.id });
                    setResults((prev) => ({ ...prev, [audit.id]: "completed" }));
                  } catch (error) {
                    setResults((prev) => ({ ...prev, [audit.id]: error instanceof Error ? error.message : "failed" }));
                  } finally {
                    setRunning(null);
                  }
                }}
              >
                {running === audit.id ? "Running..." : "Run Audit"}
              </button>
              <a className="btn btn-ghost" href={`/chat`}>View</a>
            </div>
            {results[audit.id] ? <div className="card" style={{ background: "#f7f9fc" }}>{results[audit.id]}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
