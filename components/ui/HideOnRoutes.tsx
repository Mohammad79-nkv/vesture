"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/lib/i18n/navigation";

// Hides chrome on routes that need a fullscreen surface (builder,
// stylist chat, etc). Pass route prefixes — startsWith match. The child
// is still rendered server-side; we just don't mount it on the client.
// Mirrors the existing pattern in floating-nav.tsx so the global Nav +
// FloatingNav can use the same hide-list as a single source of truth.
export function HideOnRoutes({
  patterns,
  children,
}: {
  patterns: readonly string[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  if (patterns.some((p) => pathname.startsWith(p))) return null;
  return <>{children}</>;
}
