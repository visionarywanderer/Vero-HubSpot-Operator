"use client";

import { useEffect, useState } from "react";

export function DisconnectModal({
  open,
  portalName,
  hubId,
  onClose,
  onConfirm
}: {
  open: boolean;
  portalName: string;
  hubId: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (open) setConfirmText("");
  }, [open]);

  if (!open) return null;

  const enabled = confirmText.trim() === hubId.trim();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Disconnect {portalName || hubId}?</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--muted)" }}>
          <li>Uninstall/revoke app access to this portal</li>
          <li>Preserve activity logs locally</li>
          <li>Allow reconnection later</li>
        </ul>
        <div style={{ marginTop: 10, fontSize: 12 }}>Type the Hub ID <strong>{hubId}</strong> to confirm:</div>
        <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={hubId} />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" disabled={!enabled} onClick={() => onConfirm().then(onClose)}>Disconnect</button>
        </div>
      </div>
    </div>
  );
}
