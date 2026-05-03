import { setRequestLocale } from "next-intl/server";
import { auth } from "@clerk/nextjs/server";
import { isLocale } from "@/lib/i18n/config";
import { notFound } from "next/navigation";
import { redirect } from "@/lib/i18n/navigation";
import { WelcomeHero } from "@/components/marketing/WelcomeHero";
import { WelcomePillars } from "@/components/marketing/WelcomePillars";

// First-touch landing for signed-out visitors. Mirrors the design's DWWelcome
// (desktop) + OBWelcome (mobile) — dark editorial hero, live AI stylist demo,
// four-pillar grid, seller band. Signed-in users skip the hero and land on
// the Discover catalog instead.
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const { userId } = await auth();
  if (userId) redirect({ href: "/products", locale });

  return (
    <main className="flex flex-1 flex-col">
      <WelcomeHero />
      <WelcomePillars />
    </main>
  );
}
