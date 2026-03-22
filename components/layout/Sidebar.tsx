"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { PortalPicker } from "@/components/layout/PortalPicker";

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
