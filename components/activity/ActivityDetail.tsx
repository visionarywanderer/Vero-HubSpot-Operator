"use client";

import type { ActivityEntry } from "@/hooks/useActivity";

export function ActivityDetail({ entry }: { entry: ActivityEntry }) {
  return (
    <div className="card" style={{ background: "#f7f9fc" }}>
      <div className="page-subtitle">Module: {entry.module || "n/a"}</div>
      <div className="page-subtitle">Prompt: {entry.prompt || "n/a"}</div>
      {entry.before ? <pre className="code-shell">{JSON.stringify(entry.before, null, 2)}</pre> : null}
      {entry.after ? <pre className="code-shell">{JSON.stringify(entry.after, null, 2)}</pre> : null}
      {entry.error ? <div style={{ color: "var(--danger)", fontSize: 12 }}>{entry.error}</div> : null}
    </div>
  );
}
