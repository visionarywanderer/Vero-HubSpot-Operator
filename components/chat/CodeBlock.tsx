"use client";

import { useMemo, useState } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";

export function CodeBlock({ title, code, language = "javascript", onRunDryRun }: { title: string; code: string; language?: "javascript" | "json"; onRunDryRun?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const lines = useMemo(() => code.split("\n"), [code]);
  const visible = expanded ? code : lines.slice(0, 15).join("\n");
  const html = useMemo(() => Prism.highlight(visible, Prism.languages[language], language), [language, visible]);

  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>{title}</h3>
      <pre className="code-shell"><code dangerouslySetInnerHTML={{ __html: html }} /></pre>
      {lines.length > 15 ? (
        <button className="btn btn-ghost" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(code).catch(() => undefined)}>Copy</button>
        <button className="btn btn-ghost" onClick={() => {
          const blob = new Blob([code], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "generated-script.js";
          a.click();
          URL.revokeObjectURL(url);
        }}>Download .js</button>
        {onRunDryRun ? <button className="btn btn-primary" onClick={onRunDryRun}>Run Dry-Run</button> : null}
      </div>
    </div>
  );
}
