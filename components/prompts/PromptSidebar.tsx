"use client";

import { useMemo, useState } from "react";
import { PromptCard, type PromptItem } from "@/components/prompts/PromptCard";
import { PromptParamsModal } from "@/components/prompts/PromptParamsModal";

export function PromptSidebar({
  prompts,
  onInsert
}: {
  prompts: PromptItem[];
  onInsert: (text: string, parameters?: Record<string, string>) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PromptItem | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return prompts;
    return prompts.filter((p) => [p.name, p.description, p.category, ...p.tags].join(" ").toLowerCase().includes(q));
  }, [prompts, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, PromptItem[]>();
    for (const item of filtered) {
      const existing = map.get(item.category) ?? [];
      existing.push(item);
      map.set(item.category, existing);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <aside className="card stack prompt-sidebar">
      <h3>Prompt Library</h3>
      <input className="input" placeholder="Search prompts..." value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="prompt-list">
        {grouped.map(([category, items]) => (
          <div key={category} className="stack" style={{ gap: 8 }}>
            <div className="prompt-category">{category.toUpperCase()} ({items.length})</div>
            {items.map((item) => (
              <PromptCard
                key={item.id}
                item={item}
                onSelect={(next) => {
                  if (next.parameters?.length) {
                    setSelected(next);
                    return;
                  }
                  onInsert(next.prompt || next.name);
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <PromptParamsModal
        open={Boolean(selected)}
        promptName={selected?.name || ""}
        parameters={selected?.parameters || []}
        onClose={() => setSelected(null)}
        onSubmit={(values) => {
          if (!selected) return;
          onInsert(selected.prompt || selected.name, values);
          setSelected(null);
        }}
      />
    </aside>
  );
}
