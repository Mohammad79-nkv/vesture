import type { ReactNode } from "react";
import { Nav } from "@/components/ui/Nav";
import { Footer } from "@/components/ui/Footer";
import { FloatingNav } from "@/components/ui/floating-nav";

// Buyer-side shell: products / sellers / favorites / stylist all share the
// global Nav, Footer, and mobile FloatingNav. The welcome landing
// (`(marketing)`) and dashboard / admin live outside this group and render
// their own chrome.
export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      {children}
      <Footer />
      <FloatingNav />
    </>
  );
}
