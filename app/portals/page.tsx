"use client";

import { Suspense, useMemo, useState, useEffect } from "react";
import { usePortal } from "@/hooks/usePortal";
import { apiPost } from "@/lib/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConnectModal } from "@/components/portals/ConnectModal";
import { DisconnectModal } from "@/components/portals/DisconnectModal";
import { useSearchParams } from "next/navigation";

function PortalsContent() {
  const { portals, activePortal, setActivePortal, refresh } = usePortal();
  const [connectOpen, setConnectOpen] = useState(false);
  const [disconnectPortalId, setDisconnectPortalId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // Auto-refresh portal list when redirected back from OAuth callback
  useEffect(() => {
    if (searchParams.get("connected")) {
      refresh();
    }
  }, [searchParams, refresh]);

  const disconnectPortal = useMemo(
    () => portals.find((portal) => portal.id === disconnectPortalId) || null,
    [portals, disconnectPortalId]
  );

  return (
    <div className="stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="page-title">Portals</h1>
          <p className="page-subtitle">Manage all connected client portals.</p>
          <div className="accent-stripe" />
        </div>
        <button className="btn btn-primary" onClick={() => setConnectOpen(true)}>+ Connect New</button>
      </div>

      <div className="stack">
        {portals.map((portal) => (
          <div key={portal.id} className="card stack">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div>
                <strong>{portal.name}</strong>
                <div className="page-subtitle">Hub ID: {portal.hubId || "unknown"} · Connected: {new Date(portal.createdAt).toLocaleDateString()}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <StatusBadge status={portal.environment} />
                <StatusBadge status="connected" />
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button className="btn btn-primary" onClick={() => setActivePortal(portal.id)}>Open Dashboard</button>
              <a className="btn btn-ghost" href={`/settings?portal=${portal.id}`}>Configure</a>
              <a className="btn btn-ghost" href={`/activity?portalId=${portal.id}`}>Activity Log</a>
              <button className="btn btn-danger" onClick={() => setDisconnectPortalId(portal.id)}>Disconnect</button>
            </div>
          </div>
        ))}

        {!portals.length ? <div className="empty-state">No portals connected yet.</div> : null}
      </div>

      <ConnectModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
      />

      <DisconnectModal
        open={Boolean(disconnectPortal)}
        portalName={disconnectPortal?.name || ""}
        onClose={() => setDisconnectPortalId(null)}
        onConfirm={async () => {
          if (!disconnectPortal) return;
          await apiPost(`/api/portals/${disconnectPortal.id}/disconnect`, {});
          await refresh();
        }}
      />

      {activePortal ? <div className="page-subtitle">Active portal: {activePortal.name}</div> : null}
    </div>
  );
}

export default function PortalsPage() {
  return (
    <Suspense>
      <PortalsContent />
    </Suspense>
  );
}
