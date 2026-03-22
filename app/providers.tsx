"use client";

import { SessionProvider } from "next-auth/react";
import { PortalProvider } from "@/contexts/PortalContext";
import { ToastProvider } from "@/components/shared/Toast";

// next-auth v4 SessionProvider returns JSX.Element which is incompatible with
// React 19's stricter JSX component return-type constraints. Cast to a generic
// ComponentType so both React 18 and React 19 type checkers accept it without
// any suppression directive. Remove once next-auth ships React 19 types.
const CompatSessionProvider = SessionProvider as unknown as React.ComponentType<{
  children?: React.ReactNode;
  basePath?: string;
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
  refetchWhenOffline?: boolean;
}>;

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CompatSessionProvider refetchOnWindowFocus={false} refetchWhenOffline={false}>
      <PortalProvider><ToastProvider>{children}</ToastProvider></PortalProvider>
    </CompatSessionProvider>
  );
}
