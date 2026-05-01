import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/lib/i18n/config";

// Placeholder until Phase 2. The route exists so the nav link works.
export default async function StylistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-32 text-center">
      <p className="mb-4 text-xs uppercase tracking-[0.3em] text-ink/60">Phase 2</p>
      <h1 className="mb-4 text-4xl font-light">AI Stylist coming soon</h1>
      <p className="text-ink/70">
        Personalized outfit recommendations from across our boutiques.
      </p>
    </main>
  );
}
