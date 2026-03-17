"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { PortalPicker } from "@/components/layout/PortalPicker";

const NAV = [
  {
    group: "OPERATE",
    items: [
      { label: "Dashboard", href: "/" },
      { label: "How It Works", href: "/how-it-works" },
      { label: "Templates", href: "/templates" },
      { label: "Prompt Packs", href: "/prompt-packs" },
    ],
  },
  {
    group: "MANAGE",
    items: [
      { label: "Portals", href: "/portals" },
      { label: "Workflows", href: "/workflows" },
      { label: "Properties", href: "/properties" },
      { label: "Lists & Segments", href: "/lists" },
      { label: "Pipelines", href: "/pipelines" },
      { label: "Bulk Operations", href: "/bulk" },
    ],
  },
  {
    group: "INFRASTRUCTURE",
    items: [
      { label: "Environments", href: "/environments" },
      { label: "Clone Portal", href: "/clone" },
      { label: "Config Diff", href: "/diff" },
      { label: "Deployments", href: "/deployments" },
    ],
  },
  {
    group: "SYSTEM",
    items: [
      { label: "Activity Log", href: "/activity" },
      { label: "Settings", href: "/settings" },
    ],
  },
];

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { data } = useSession();

  const activeGroup = NAV.find((g) => g.items.some((item) => item.href === pathname))?.group || "OPERATE";
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
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="sidebar-header">
        <div className="logo">VeroHub</div>
        <div className="subtitle">HubSpot Operator</div>
        <div className="accent-stripe short" />
      </div>

      <PortalPicker />

      <nav className="nav-groups">
        {NAV.map((group) => {
          const isOpen = openGroups.has(group.group);
          const hasActiveItem = group.items.some((item) => item.href === pathname);

          return (
            <div key={group.group} className="nav-group">
              <div className="nav-group-header" onClick={() => toggleGroup(group.group)}>
                <span className={`nav-label${hasActiveItem ? " nav-label-active" : ""}`}>
                  {group.group}
                </span>
                <span className={`nav-chevron${isOpen ? " open" : ""}`}>›</span>
              </div>
              <div className="nav-items" style={{ maxHeight: isOpen ? `${group.items.length * 34}px` : "0px" }}>
                {group.items.map((item) => {
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
