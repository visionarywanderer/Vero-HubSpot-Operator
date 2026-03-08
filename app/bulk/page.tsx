"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api";
import { usePortal } from "@/hooks/usePortal";

type GeneratedScript = {
  id: string;
  module: string;
  description: string;
  code: string;
};

export default function BulkPage() {
  const { activePortal } = usePortal();
  const [prompt, setPrompt] = useState("Fetch all contacts and standardize first/last names and email casing.");
  const [script, setScript] = useState<GeneratedScript | null>(null);
  const [status, setStatus] = useState("");

  return (
    <div className="stack">
      <h1 className="page-title">Bulk Operations</h1>
      <div className="card stack">
        <textarea className="textarea" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" disabled={!activePortal} onClick={async () => {
            if (!activePortal) return;
            const resp = await apiPost<{ ok: true; script: GeneratedScript }>("/api/scripts/generate", { portalId: activePortal.id, prompt });
            setScript(resp.script);
          }}>Generate Script</button>
          <button className="btn btn-ghost" disabled={!script} onClick={async () => {
            if (!script) return;
            const resp = await apiPost<{ ok: true; result: { recordsChanged: number } }>("/api/scripts/dry-run", { script });
            setStatus(`Dry-run done. Pending changes: ${resp.result.recordsChanged}`);
          }}>Run Dry-Run</button>
          <button className="btn btn-danger" disabled={!script} onClick={async () => {
            if (!script) return;
            const resp = await apiPost<{ ok: true; result: { recordsChanged: number } }>("/api/scripts/execute", { script, mode: "execute" });
            setStatus(`Executed. Changes: ${resp.result.recordsChanged}`);
          }}>Execute for Real</button>
        </div>
      </div>
      {script && <pre className="card" style={{ fontFamily: "var(--font-mono)", fontSize: 12, overflow: "auto" }}>{script.code}</pre>}
      {status && <div className="card">{status}</div>}
    </div>
  );
}
