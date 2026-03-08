"use client";

import { usePortalContext } from "@/contexts/PortalContext";

export function usePortal() {
  return usePortalContext();
}
