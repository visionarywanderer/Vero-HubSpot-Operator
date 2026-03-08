"use client";

import { useState } from "react";
import { usePortal } from "@/hooks/usePortal";
import { StatusBadge } from "@/components/shared/StatusBadge";

export function PortalPicker() {
  const { portals, activePortal, setActivePortal, loading } = usePortal();
  const [open, setOpen] = useState(false);

  if (loading) {
    return <div className="portal-picker">Loading portals...</div>;
  }

  return (
    <div className="portal-picker-wrap">
      <button className="portal-picker" onClick={() => setOpen((v) => !v)}>
        <span>{activePortal?.name || "Select portal"}</span>
        <span>▾</span>
      </button>
      {activePortal && (
        <div className="portal-picker-meta">
          <StatusBadge status={activePortal.environment} />
        </div>
      )}
      {open && (
        <div className="portal-menu">
          {portals.map((portal) => (
            <button
              key={portal.id}
              className="portal-menu-item"
              onClick={async () => {
                await setActivePortal(portal.id);
                setOpen(false);
              }}
            >
              <span>{portal.name}</span>
              <StatusBadge status={portal.environment} />
            </button>
          ))}
          <a className="portal-connect-link" href="/portals">
            + Connect New Portal
          </a>
        </div>
      )}
    </div>
  );
}
