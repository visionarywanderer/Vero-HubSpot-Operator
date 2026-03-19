"use client";

import { SessionProvider } from "next-auth/react";
import { PortalProvider } from "@/contexts/PortalContext";

// next-auth v4 SessionProvider return type (Element) is incompatible with React 19
// JSX types which require ReactNode | Promise<ReactNode>. Wrapping with a typed
// component and a targeted suppress fixes this without losing runtime behaviour.
// Remove once next-auth ships React 19-compatible types.
function AuthSessionProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  // @ts-expect-error next-auth v4 SessionProvider return type incompatible with React 19
  return <SessionProvider>{children}</SessionProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
      <PortalProvider>{children}</PortalProvider>
    </AuthSessionProvider>
  );
}
