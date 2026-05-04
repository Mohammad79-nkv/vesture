import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/lib/i18n/config";

// Placeholder until the closet feature ships. The route exists so the new
// bottom-nav Closet tab links somewhere instead of 404'ing.
export default async function ClosetPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-32 text-center">
      <p className="mb-4 text-xs uppercase tracking-[0.3em] text-ink/60">
        Coming soon
      </p>
      <h1 className="mb-4 text-4xl font-light">Your closet, organized.</h1>
      <p className="text-ink/70">
        Photograph what you own. The stylist mixes owned + new so you only buy
        what fills a gap.
      </p>
    </main>
  );
}
