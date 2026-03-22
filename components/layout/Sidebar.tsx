"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { PortalPicker } from "@/components/layout/PortalPicker";

/* ── Inline SVG icons (16×16, stroke-based, currentColor) ── */
const sz = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const ICONS: Record<string, ReactNode> = {
  "/":             <svg {...sz}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  "/how-it-works": <svg {...sz}><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>,
  "/prompts":      <svg {...sz}><path d="M9.5 2a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 0 0-7"/><path d="M12 2v7"/><path d="M8 9l-2.5 6.5L12 22l6.5-6.5L16 9"/></svg>,
  "/templates":    <svg {...sz}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>,
  "/properties":   <svg {...sz}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  "/pipelines":    <svg {...sz}><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>,
  "/workflows":    <svg {...sz}><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M6 9v12"/></svg>,
  "/lists":        <svg {...sz}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  "/portals":      <svg {...sz}><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>,
  "/environments": <svg {...sz}><path d="M12.5 2H8a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 0-1 1v1a1 1 0 0 1-1 1H3a1 1 0 0 0-1 1v3"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M2 18h20"/></svg>,
  "/deployments":  <svg {...sz}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>,
  "/activity":     <svg {...sz}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  "/settings":     <svg {...sz}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>,
};

type NavItem = { label: string; href: string; external?: boolean };
type NavGroup = { group: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    group: "OVERVIEW",
    items: [
      { label: "Dashboard", href: "/" },
      { label: "How It Works", href: "/how-it-works" },
    ],
  },
  {
    group: "CONFIGURE",
    items: [
      { label: "Prompt Library", href: "/prompts" },
      { label: "Templates", href: "/templates" },
      { label: "Properties", href: "/properties" },
      { label: "Pipelines", href: "/pipelines" },
      { label: "Workflows", href: "/workflows" },
      { label: "Lists & Segments", href: "/lists" },
    ],
  },
  {
    group: "PORTALS",
    items: [
      { label: "Portals", href: "/portals" },
      { label: "Environments", href: "/environments" },
      { label: "Deployments", href: "/deployments" },
    ],
  },
  {
    group: "SYSTEM",
    items: [
      { label: "Activity Log", href: "/activity" },
      { label: "Settings", href: "/settings" },
      { label: "HubSpot Audit", href: "https://hubspot-audit-tool-production.up.railway.app/", external: true },
    ],
  },
];

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { data } = useSession();

  const activeGroup = NAV.find((g) => g.items.some((item) => item.href === pathname))?.group || "OVERVIEW";
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set([activeGroup]));

  const toggleGroup = (group: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  return (
    <aside className={`sidebar${isOpen ? "" : " collapsed"}`}>
      <div className="sidebar-header">
        <div className="logo">VeroHub</div>
        <div className="subtitle">HubSpot Operator</div>
        <div className="accent-stripe short" />
      </div>

      <PortalPicker />

      <nav className="nav-groups">
        {NAV.map((group) => {
          const isGroupOpen = openGroups.has(group.group);
          const hasActiveItem = group.items.some((item) => item.href === pathname);

          return (
            <div key={group.group} className="nav-group">
              <div className="nav-group-header" onClick={() => toggleGroup(group.group)}>
                <span className={`nav-label${hasActiveItem ? " nav-label-active" : ""}`}>
                  {group.group}
                </span>
                <span className={`nav-chevron${isGroupOpen ? " open" : ""}`}>&#8250;</span>
              </div>
              <div className="nav-items" style={{ maxHeight: isGroupOpen ? `${group.items.length * 36}px` : "0px" }}>
                {group.items.map((item) => {
                  if (item.external) {
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="nav-item"
                        onClick={onClose}
                      >
                        <span className="nav-item-icon">{ICONS[item.href]}</span>
                        {item.label}
                        <span className="external-icon" aria-hidden="true">&thinsp;&#8599;</span>
                      </a>
                    );
                  }
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-item ${active ? "active" : ""}`}
                      onClick={onClose}
                    >
                      <span className="nav-item-icon">{ICONS[item.href]}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-email" title={data?.user?.email || ""}>{data?.user?.email || "Unknown user"}</div>
        <button className="signout-link" onClick={() => signOut({ callbackUrl: "/login" })}>Sign Out</button>
      </div>
    </aside>
  );
}
