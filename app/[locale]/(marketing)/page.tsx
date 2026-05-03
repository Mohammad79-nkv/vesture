import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/lib/i18n/config";
import { notFound } from "next/navigation";
import { WelcomeHero } from "@/components/marketing/WelcomeHero";
import { WelcomePillars } from "@/components/marketing/WelcomePillars";

// First-touch landing for signed-out visitors. Mirrors the design's DWWelcome
// (desktop) + OBWelcome (mobile) — dark editorial hero, live AI stylist demo,
// four-pillar grid, seller band. The global Nav/Footer/FloatingNav are hidden
// on this route via BuyerChrome / FloatingNav (both check pathname === "/").
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    <main className="flex flex-1 flex-col">
      <WelcomeHero />
      <WelcomePillars />
    </main>
  );
}
