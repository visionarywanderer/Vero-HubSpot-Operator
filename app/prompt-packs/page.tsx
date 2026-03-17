"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";

type PromptPack = {
  id: string;
  filename: string;
  title: string;
  purpose: string;
  content: string;
};

const CATEGORIES: Record<string, { label: string; keywords: string[] }> = {
  properties: { label: "Properties", keywords: ["property", "properties", "enrichment", "lifecycle", "reporting", "scoring", "abm"] },
  pipelines: { label: "Pipelines", keywords: ["pipeline", "deal_pipeline", "ticket_pipeline"] },
  workflows: { label: "Workflows", keywords: ["workflow", "onboarding", "re_engagement"] },
  lists: { label: "Lists", keywords: ["list", "segmentation"] },
  templates: { label: "Full Templates", keywords: ["revops", "full_crm", "portal_clone"] },
  scripts: { label: "Scripts", keywords: ["script", "bulk", "cleanup"] },
  advanced: { label: "Advanced", keywords: ["custom_object"] },
};

function categorize(id: string): string {
  for (const [cat, { keywords }] of Object.entries(CATEGORIES)) {
    if (keywords.some((kw) => id.includes(kw))) return cat;
  }
  return "templates";
}

export default function PromptPacksPage() {
  const [packs, setPacks] = useState<PromptPack[]>([]);
  const [selected, setSelected] = useState<PromptPack | null>(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    apiGet<{ ok: true; packs: PromptPack[] }>("/api/prompt-packs")
      .then((resp) => setPacks(resp.packs))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return packs.filter((p) => {
      if (activeCategory !== "all" && categorize(p.id) !== activeCategory) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.purpose.toLowerCase().includes(q) || p.id.includes(q);
    });
  }, [packs, search, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: packs.length };
    for (const pack of packs) {
      const cat = categorize(pack.id);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [packs]);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (selected) {
    return (
      <div className="stack">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-ghost" onClick={() => setSelected(null)}>
            Back
          </button>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>{selected.title}</h2>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{selected.purpose}</div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => copyToClipboard(selected.content)}
          >
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
        </div>

        <div className="card" style={{ borderLeft: "3px solid var(--accent)" }}>
          <div style={{ fontSize: 11, color: "var(--accent)", marginBottom: 8, fontWeight: 500 }}>
            Look for {"{{PLACEHOLDER}}"} values below to customize this prompt for your use case.
          </div>
        </div>

        <div className="card">
          <pre
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: 0,
              maxHeight: "70vh",
              overflow: "auto",
              lineHeight: 1.6,
            }}
          >
            {selected.content}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1 className="page-title">Prompt Packs</h1>
      <p className="page-subtitle">
        Copy-paste prompts for use with Claude. Each pack generates valid Config Engine payloads you can install directly.
      </p>

      {/* Search + Category Filter */}
      <div className="card" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 180 }}
          placeholder="Search prompt packs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button
            className={activeCategory === "all" ? "btn btn-primary" : "btn btn-ghost"}
            style={{ fontSize: 10 }}
            onClick={() => setActiveCategory("all")}
          >
            All ({categoryCounts.all || 0})
          </button>
          {Object.entries(CATEGORIES).map(([key, { label }]) => (
            <button
              key={key}
              className={activeCategory === key ? "btn btn-primary" : "btn btn-ghost"}
              style={{ fontSize: 10 }}
              onClick={() => setActiveCategory(key)}
            >
              {label} ({categoryCounts[key] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Pack Grid */}
      <div className="card-grid two">
        {filtered.map((pack) => (
          <div
            key={pack.id}
            className="card"
            style={{ cursor: "pointer", transition: "border-color 0.15s" }}
            onClick={() => setSelected(pack)}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent-border)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{pack.title}</h3>
              <span style={{
                fontSize: 9,
                padding: "2px 6px",
                borderRadius: 3,
                background: "var(--accent-dim)",
                color: "var(--accent)",
                border: "1px solid var(--accent-border)",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}>
                {CATEGORIES[categorize(pack.id)]?.label || "Template"}
              </span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--ink-secondary)", lineHeight: 1.5 }}>
              {pack.purpose}
            </p>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          {packs.length === 0
            ? "No prompt packs found. Add .md files to the prompt_packs/ directory."
            : "No packs match your search."}
        </div>
      )}
    </div>
  );
}
