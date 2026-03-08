"use client";

type PromptParameter = { name: string; default?: string; options?: string[] };

export type PromptItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  prompt?: string;
  parameters?: PromptParameter[];
};

export function PromptCard({ item, onSelect }: { item: PromptItem; onSelect: (item: PromptItem) => void }) {
  return (
    <button className="prompt-card" onClick={() => onSelect(item)}>
      <div className="prompt-title">{item.name}</div>
      <div className="prompt-desc">{item.description}</div>
      <div className="prompt-tags">
        {item.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="prompt-tag">
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}
