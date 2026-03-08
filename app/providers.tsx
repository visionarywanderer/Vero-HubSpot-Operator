"use client";

import { SessionProvider } from "next-auth/react";
import { PortalProvider } from "@/contexts/PortalContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PortalProvider>{children}</PortalProvider>
    </SessionProvider>
  );
}
