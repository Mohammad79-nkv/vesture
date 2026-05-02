"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

// Wraps the buyer-side chrome (Nav / Footer / FloatingNav) and hides it on
// seller and admin routes — those have their own SellerTopBar. Server
// components passed as children stay server-rendered.
export function BuyerChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (/\/(dashboard|admin)(\/|$)/.test(pathname)) return null;
  return <>{children}</>;
}
