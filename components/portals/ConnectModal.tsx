"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

export function ConnectModal({
  open,
  onClose,
  onSubmit
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { id: string; name: string; token: string; environment: "sandbox" | "production" }) => Promise<void>;
}) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [oauthUrl, setOauthUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiGet<{ ok: boolean; url?: string }>("/api/portals/connect")
      .then((data) => setOauthUrl(data.url || ""))
      .catch(() => setOauthUrl(""));
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Connect a New Client Portal</h3>
        <div className="stack">
          <input className="input" placeholder="Portal ID" value={id} onChange={(e) => setId(e.target.value)} />
          <input className="input" placeholder="Client Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="HubSpot private app token (optional fallback)" value={token} onChange={(e) => setToken(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <label><input type="radio" checked={environment === "sandbox"} onChange={() => setEnvironment("sandbox")} /> Sandbox</label>
            <label><input type="radio" checked={environment === "production"} onChange={() => setEnvironment("production")} /> Production</label>
          </div>
        </div>

        {oauthUrl ? (
          <div className="card" style={{ marginTop: 10 }}>
            <div className="page-subtitle">OAuth link</div>
            <code style={{ fontSize: 12, wordBreak: "break-all" }}>{oauthUrl}</code>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <a className="btn btn-ghost" href={oauthUrl} target="_blank" rel="noreferrer">Open HubSpot Authorization</a>
              <button className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(oauthUrl).catch(() => undefined)}>Copy</button>
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={saving || !id || !name || !token}
            onClick={async () => {
              setSaving(true);
              try {
                await onSubmit({ id, name, token, environment });
                onClose();
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Connecting..." : "Connect with Token Fallback"}
          </button>
        </div>
      </div>
    </div>
  );
}
