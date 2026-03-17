"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

export function ConnectModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
  /** @deprecated Token-based onSubmit is no longer used — OAuth is the only flow */
  onSubmit?: (input: { id: string; name: string; token: string; environment: "sandbox" | "production" }) => Promise<void>;
}) {
  const [oauthUrl, setOauthUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setLoading(true);
    apiGet<{ ok: boolean; url?: string; error?: string }>("/api/portals/connect")
      .then((data) => {
        if (data.url) {
          setOauthUrl(data.url);
        } else {
          setError(data.error || "Failed to generate OAuth URL");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to fetch OAuth URL");
        setOauthUrl("");
      })
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Connect a HubSpot Portal</h3>

        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
          Click the button below to authorize access via OAuth. HubSpot will ask you to grant
          permissions — only those available on your portal tier will be activated.
        </p>

        {loading ? (
          <div style={{ textAlign: "center", padding: 20 }}>Loading...</div>
        ) : error ? (
          <div className="card" style={{ borderColor: "#f2545b", color: "#8a1f26" }}>
            {error}
          </div>
        ) : oauthUrl ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <a
              className="btn btn-primary"
              href={oauthUrl}
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              Connect with HubSpot
            </a>
            <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
              You&apos;ll be redirected to HubSpot to authorize access. Scopes will adapt
              dynamically to your portal&apos;s subscription tier.
            </p>
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
