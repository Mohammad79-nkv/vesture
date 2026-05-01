import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { isLocale } from "@/lib/i18n/config";
import { notFound } from "next/navigation";
import { StylistChatPreview } from "@/components/marketing/StylistChatPreview";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("home");

  return (
    <main className="flex flex-1 flex-col bg-mist">
      <section className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:py-24">
        <div className="flex flex-col">
          <p className="mb-8 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            {t("eyebrow")}
          </p>

          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-ink md:text-6xl lg:text-7xl">
            {t("heroLine1")}
            <br />
            {t("heroLine2")} <span className="text-primary">{t("heroAccent1")}</span>.
            <br />
            {t("heroLine3")} <span className="text-secondary">{t("heroAccent2")}</span>
            <br />
            {t("heroLine4")}.
          </h1>

          <p className="mt-8 max-w-md text-base leading-relaxed text-ink/65">
            {t("heroSubtitle")}
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.15em] text-paper transition-colors hover:bg-primary/90"
            >
              <SparkleIcon />
              {t("ctaStart")}
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-full border-2 border-ink px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.15em] text-ink transition-colors hover:bg-ink hover:text-paper"
            >
              {t("ctaForSellers")}
            </Link>
          </div>

          <div className="mt-16 flex max-w-md gap-10">
            <Stat number="3,200" label={t("statsSellers")} />
            <Stat number="98,400" label={t("statsPieces")} />
            <Stat number={t("statsCities")} label={t("statsCitiesSuffix")} />
          </div>
        </div>

        <div className="lg:pt-4">
          <StylistChatPreview />
        </div>
      </section>
    </main>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <p className="text-3xl font-extrabold tracking-tight text-ink">{number}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-ink/55">
        {label}
      </p>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );
}
