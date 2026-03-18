"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePortal } from "@/hooks/usePortal";
import { StatusBadge } from "@/components/shared/StatusBadge";

function pageLabel(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  return pathname.slice(1).split("/").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" / ");
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const { data } = useSession();
  const { activePortal } = usePortal();

  return (
    <header className="topbar">
      <button className="menu-btn" onClick={onMenuClick} aria-label="Toggle sidebar">
        <MenuIcon />
      </button>
      <div className="breadcrumb">{pageLabel(pathname)}</div>
      <div className="topbar-spacer" />
      {activePortal && (
        <div className="active-portal-badge">
          <span>{activePortal.name}</span>
          <StatusBadge status={activePortal.environment} />
        </div>
      )}
      <div className="avatar" title={data?.user?.email || ""}>{(data?.user?.email || "U").charAt(0).toUpperCase()}</div>
    </header>
  );
}
