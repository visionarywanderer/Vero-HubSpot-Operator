"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/login")) {
    return <>{children}</>;
  }
  return <AppShell>{children}</AppShell>;
}
