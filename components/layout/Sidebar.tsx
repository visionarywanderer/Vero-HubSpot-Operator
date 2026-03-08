"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { PortalPicker } from "@/components/layout/PortalPicker";

const NAV = [
  { group: "OPERATE", items: [{ label: "Dashboard", href: "/" }, { label: "Chat", href: "/chat" }] },
  {
    group: "MANAGE",
    items: [
      { label: "Portals", href: "/portals" },
      { label: "Audits", href: "/audits" },
      { label: "Workflows", href: "/workflows" },
      { label: "Properties", href: "/properties" },
      { label: "Lists & Segments", href: "/lists" },
      { label: "Pipelines", href: "/pipelines" },
      { label: "Bulk Operations", href: "/bulk" }
    ]
  },
  { group: "SYSTEM", items: [{ label: "Activity Log", href: "/activity" }, { label: "Settings", href: "/settings" }] }
];

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { data } = useSession();

  return (
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="sidebar-header">
        <div className="logo">VeroHub</div>
        <div className="subtitle">HubSpot Operator</div>
        <div className="accent-stripe short" />
      </div>

      <PortalPicker />

      <nav className="nav-groups">
        {NAV.map((group) => (
          <div key={group.group} className="nav-group">
            <div className="nav-label">{group.group}</div>
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
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-email" title={data?.user?.email || ""}>{data?.user?.email || "Unknown user"}</div>
        <button className="signout-link" onClick={() => signOut({ callbackUrl: "/login" })}>Sign Out</button>
      </div>
    </aside>
  );
}
