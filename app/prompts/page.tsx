"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PromptParamsModal } from "@/components/prompts/PromptParamsModal";
import type { PromptItem } from "@/components/prompts/PromptCard";

interface PromptPack {
  id: string;
  filename: string;
  title: string;
  purpose: string;
  content: string;
}

const CATEGORIES = ["all", "audit", "meeting", "property", "pipeline", "workflow", "workflow-management", "list", "bulk", "template", "record", "export", "deploy", "task", "portal", "packs"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  all: "All",
  audit: "Audit & Health",
  meeting: "Meeting Analysis",
  property: "Properties",
  pipeline: "Pipelines",
  workflow: "Workflows",
  "workflow-management": "Workflow Mgmt",
  list: "Lists & Segments",
  bulk: "Bulk Ops",
  template: "Templates & Setup",
  record: "Records",
  export: "Export & Clone",
  deploy: "Deployment",
  task: "Task Delivery",
  portal: "Portal Mgmt",
  packs: "Prompt Packs",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button className="btn btn-copy" onClick={handleCopy} title="Copy to clipboard">
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function PromptExpandCard({
  item,
  onParamInsert,
}: {
  item: PromptItem;
  onParamInsert: (item: PromptItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card prompt-expand-card" style={{ padding: 16 }}>
      <div style={{ cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>{item.name}</h3>
              <span className="badge prompt-category-badge">{item.category}</span>
            </div>
            <p style={{ margin: "4px 0 8px", color: "var(--fg-secondary)", fontSize: 13 }}>{item.description}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {item.tags.map((tag) => (
                <span key={tag} className="badge" style={{ fontSize: 11 }}>{tag}</span>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
            {item.parameters?.length ? (
              <button
                className="btn btn-ghost"
                onClick={(e) => { e.stopPropagation(); onParamInsert(item); }}
                title="Fill parameters and copy"
              >
                Params
              </button>
            ) : null}
            <CopyButton text={item.prompt || item.name} />
            <span style={{ fontSize: 16, color: "var(--muted)", transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "rotate(0)" }}>
              &#8250;
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="prompt-expand-body">
          <pre className="prompt-text">{item.prompt}</pre>
          {item.parameters?.length ? (
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              Parameters: {item.parameters.map((p) => p.name).join(", ")}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PackExpandCard({ pack }: { pack: PromptPack }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card prompt-expand-card" style={{ padding: 16 }}>
      <div style={{ cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>{pack.title}</h3>
              <span className="badge prompt-category-badge">pack</span>
            </div>
            <p style={{ margin: "4px 0 0", color: "var(--fg-secondary)", fontSize: 13 }}>
              {pack.purpose || "Prompt pack template"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
            <CopyButton text={pack.content} />
            <span style={{ fontSize: 16, color: "var(--muted)", transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "rotate(0)" }}>
              &#8250;
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="prompt-expand-body">
          <pre className="prompt-text">{pack.content}</pre>
        </div>
      )}
    </div>
  );
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [packs, setPacks] = useState<PromptPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [paramModal, setParamModal] = useState<PromptItem | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [promptsRes, packsRes] = await Promise.all([
        fetch("/api/prompts").then((r) => (r.ok ? r.json() : { prompts: [] })).catch(() => ({ prompts: [] })),
        fetch("/api/prompt-packs").then((r) => (r.ok ? r.json() : { packs: [] })).catch(() => ({ packs: [] })),
      ]);
      setPrompts(Array.isArray(promptsRes) ? promptsRes : promptsRes.prompts ?? []);
      setPacks(packsRes.packs ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredPrompts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prompts.filter((p) => {
      if (category !== "all" && category !== "packs" && p.category !== category) return false;
      if (category === "packs") return false;
      if (!q) return true;
      return [p.name, p.description, p.category, ...p.tags].join(" ").toLowerCase().includes(q);
    });
  }, [prompts, query, category]);

  const filteredPacks = useMemo(() => {
    if (category !== "all" && category !== "packs") return [];
    const q = query.trim().toLowerCase();
    if (!q) return packs;
    return packs.filter((p) => [p.title, p.purpose, p.filename].join(" ").toLowerCase().includes(q));
  }, [packs, query, category]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: prompts.length + packs.length, packs: packs.length };
    for (const p of prompts) {
      map[p.category] = (map[p.category] ?? 0) + 1;
    }
    return map;
  }, [prompts, packs]);

  const handleParamCopy = (values: Record<string, string>) => {
    if (!paramModal) return;
    let text = paramModal.prompt || paramModal.name;
    for (const [key, value] of Object.entries(values)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }
    navigator.clipboard.writeText(text).catch(() => {});
    setParamModal(null);
  };

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Prompt Library</h1>
        <p className="page-subtitle">
          {prompts.length} ready-to-use prompts for HubSpot operations. Click any prompt to expand and copy.
        </p>
        <div className="accent-stripe" />
      </div>

      {/* Search */}
      <div className="card" style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "center" }}>
        <input
          className="input"
          placeholder="Search prompts by name, description, or tag..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
          {filteredPrompts.length + filteredPacks.length} result{filteredPrompts.length + filteredPacks.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Category Chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {CATEGORIES.filter((cat) => cat === "all" || cat === "packs" || (counts[cat] ?? 0) > 0).map((cat) => (
          <button
            key={cat}
            className={`btn prompt-chip${category === cat ? " prompt-chip-active" : ""}`}
            onClick={() => setCategory(cat)}
          >
            {CATEGORY_LABELS[cat]}
            {counts[cat] ? ` (${counts[cat]})` : ""}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading prompts...</p>
      ) : filteredPrompts.length === 0 && filteredPacks.length === 0 ? (
        <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--fg-secondary)" }}>
          No prompts match your search.
        </div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {filteredPrompts.map((item) => (
            <PromptExpandCard key={item.id} item={item} onParamInsert={setParamModal} />
          ))}
          {filteredPacks.length > 0 && filteredPrompts.length > 0 && (
            <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginTop: 16 }}>
              Prompt Packs
            </h2>
          )}
          {filteredPacks.map((pack) => (
            <PackExpandCard key={pack.id} pack={pack} />
          ))}
        </div>
      )}

      <PromptParamsModal
        open={Boolean(paramModal)}
        promptName={paramModal?.name || ""}
        parameters={paramModal?.parameters || []}
        onClose={() => setParamModal(null)}
        onSubmit={handleParamCopy}
      />
    </div>
  );
}
