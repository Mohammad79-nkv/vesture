import type { ReactNode } from "react";
import { Nav } from "@/components/ui/Nav";
import { Footer } from "@/components/ui/Footer";

// Auth screens (sign-in / sign-up) keep the global Nav + Footer for context
// but skip the bottom mobile FloatingNav — the Clerk forms own that area.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      {children}
      <Footer />
    </>
  );
}
