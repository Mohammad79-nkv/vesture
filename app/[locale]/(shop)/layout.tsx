import type { ReactNode } from "react";
import { Nav } from "@/components/ui/Nav";
import { Footer } from "@/components/ui/Footer";
import { FloatingNav } from "@/components/ui/floating-nav";
import { HideOnRoutes } from "@/components/ui/HideOnRoutes";

// Buyer-side shell: products / sellers / favorites / stylist all share the
// global Nav, Footer, and mobile FloatingNav. The welcome landing
// (`(marketing)`) and dashboard / admin live outside this group and render
// their own chrome.
//
// Fullscreen routes (builder, today, calendar) hide Nav + Footer because
// they own their own header / time-stamp eyebrow / dock. FloatingNav
// stays visible on /today and /calendar but self-hides on builder via
// its own pathname check at components/ui/floating-nav.tsx.
const FULLSCREEN_ROUTES = [
  "/closet/builder",
  "/today",
  "/calendar",
] as const;

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <HideOnRoutes patterns={FULLSCREEN_ROUTES}>
        <Nav />
      </HideOnRoutes>
      {children}
      <HideOnRoutes patterns={FULLSCREEN_ROUTES}>
        <Footer />
      </HideOnRoutes>
      <FloatingNav />
    </>
  );
}
