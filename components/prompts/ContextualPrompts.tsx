"use client";

import { useEffect, useMemo, useState } from "react";
import { PromptCard, type PromptItem } from "@/components/prompts/PromptCard";
import { PromptParamsModal } from "@/components/prompts/PromptParamsModal";

export function ContextualPrompts({ categories }: { categories: string[] }) {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PromptItem | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/prompts")
      .then((r) => r.json())
      .then((data) => setPrompts(data.prompts ?? []))
      .catch(() => setPrompts([]));
  }, []);

  const filtered = useMemo(
    () => prompts.filter((p) => categories.includes(p.category)),
    [prompts, categories]
  );

  const handleInsert = (text: string, parameters?: Record<string, string>) => {
    let resolved = text;
    if (parameters) {
      for (const [key, value] of Object.entries(parameters)) {
        resolved = resolved.replace(new RegExp(`\\{${key}\\}`, "g"), value);
      }
    }
    navigator.clipboard.writeText(resolved).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (filtered.length === 0) return null;

  return (
    <>
      <div className="contextual-prompts">
        <div className="contextual-prompts-header" onClick={() => setOpen(!open)}>
          <h4>Suggested Prompts ({filtered.length})</h4>
          <span className={`contextual-prompts-chevron${open ? " open" : ""}`}>&#8250;</span>
        </div>
        {open && (
          <div className="contextual-prompts-body">
            {filtered.map((item) => (
              <PromptCard
                key={item.id}
                item={item}
                onSelect={(next) => {
                  if (next.parameters?.length) {
                    setSelected(next);
                    return;
                  }
                  handleInsert(next.prompt || next.name);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {copied && <div className="prompt-toast">Prompt copied to clipboard</div>}

      <PromptParamsModal
        open={Boolean(selected)}
        promptName={selected?.name || ""}
        parameters={selected?.parameters || []}
        onClose={() => setSelected(null)}
        onSubmit={(values) => {
          if (!selected) return;
          handleInsert(selected.prompt || selected.name, values);
          setSelected(null);
        }}
      />
    </>
  );
}
