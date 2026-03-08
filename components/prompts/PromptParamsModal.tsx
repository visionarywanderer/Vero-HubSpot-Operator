"use client";

import { useMemo, useState } from "react";

type PromptParameter = { name: string; default?: string; options?: string[] };

export function PromptParamsModal({
  open,
  promptName,
  parameters,
  onClose,
  onSubmit
}: {
  open: boolean;
  promptName: string;
  parameters: PromptParameter[];
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => void;
}) {
  const initial = useMemo(() => Object.fromEntries(parameters.map((p) => [p.name, p.default ?? ""])), [parameters]);
  const [values, setValues] = useState<Record<string, string>>(initial);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Prompt Parameters</h3>
        <p className="page-subtitle">{promptName}</p>
        <div className="stack">
          {parameters.map((param) => (
            <label key={param.name}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>{param.name}</div>
              {param.options?.length ? (
                <select
                  className="select"
                  value={values[param.name] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [param.name]: e.target.value }))}
                >
                  {param.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  value={values[param.name] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [param.name]: e.target.value }))}
                />
              )}
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSubmit(values)}>Insert Prompt</button>
        </div>
      </div>
    </div>
  );
}
