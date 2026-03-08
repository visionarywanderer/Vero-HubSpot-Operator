"use client";

import { useEffect, useRef } from "react";

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  portalLabel
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  portalLabel?: string;
}) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const active = document.activeElement as HTMLElement | null;
        if (active?.tagName === "INPUT" || active?.tagName === "TEXTAREA") return;
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="stack" style={{ gap: 8 }}>
      {portalLabel ? <div className="portal-pill">Operating on: {portalLabel}</div> : <div className="warning-pill">Select a portal before running operations</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <textarea
          ref={inputRef}
          className="textarea"
          style={{ minHeight: 72 }}
          placeholder="Ask the operator anything... or pick a prompt from the library →"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <button className="btn btn-primary" disabled={disabled} onClick={onSend}>Send</button>
      </div>
    </div>
  );
}
