"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { apiGet } from "@/lib/api";

export type PortalCapabilities = {
  contacts: boolean;
  companies: boolean;
  deals: boolean;
  tickets: boolean;
  lineItems: boolean;
  quotes: boolean;
  orders: boolean;
  calls: boolean;
  notes: boolean;
  tasks: boolean;
  emails: boolean;
  meetings: boolean;
  properties: boolean;
  pipelines: boolean;
  users: boolean;
  ecommerce: boolean;
  workflows: boolean;
  forms: boolean;
  files: boolean;
  timeline: boolean;
  customObjects: boolean;
  lists: boolean;
  cms: boolean;
  conversations: boolean;
  importExport: boolean;
  sensitiveData: boolean;
};

export type Portal = {
  id: string;
  name: string;
  hubId: string;
  scopes: string[];
  capabilities: PortalCapabilities;
  environment: "production" | "sandbox";
  createdAt: string;
  lastValidated: string;
};

type PortalContextValue = {
  portals: Portal[];
  activePortal: Portal | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setActivePortal: (portalId: string) => Promise<void>;
};

const PortalContext = createContext<PortalContextValue | null>(null);
const STORAGE_KEY = "vero_active_portal_id";

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [portals, setPortals] = useState<Portal[]>([]);
  const [activePortalId, setActivePortalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const portalsResp = await apiGet<{ ok: true; portals: Portal[] }>("/api/portals");
      const list = portalsResp.portals ?? [];
      setPortals(list);

      const savedId = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      const fallbackId = list[0]?.id ?? null;
      const nextId = savedId && list.some((p) => p.id === savedId) ? savedId : fallbackId;
      setActivePortalId(nextId);
      if (nextId && typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, nextId);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Only fetch portals when the user is authenticated.
  // Without this guard, the /api/portals call returns 401 on the login page,
  // lib/api.ts redirects to /login, and the page reloads in an infinite loop.
  useEffect(() => {
    if (status === "authenticated") {
      refresh().catch(() => setLoading(false));
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [refresh, status]);

  const setActivePortal = useCallback(async (portalId: string) => {
    setActivePortalId(portalId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, portalId);
    }
  }, []);

  const activePortal = useMemo(() => {
    if (!activePortalId) return portals[0] || null;
    return portals.find((portal) => portal.id === activePortalId) || portals[0] || null;
  }, [portals, activePortalId]);

  const value = useMemo(
    () => ({ portals, activePortal, loading, refresh, setActivePortal }),
    [portals, activePortal, loading, refresh, setActivePortal]
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortalContext(): PortalContextValue {
  const value = useContext(PortalContext);
  if (!value) {
    throw new Error("usePortalContext must be used within PortalProvider");
  }
  return value;
}
