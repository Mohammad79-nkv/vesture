import { getTranslations } from "next-intl/server";

// Coming-soon promo strip used between the product detail and the
// "More from seller" carousel. Replaces the AI "Build the look" CTA from
// the design until Phase 2 ships the live stylist.
export async function StylistCallout() {
  const t = await getTranslations("stylistCallout");
  return (
    <section className="mt-12 rounded-2xl bg-ink p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-paper"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
          </svg>
        </span>

        <div className="flex-1 min-w-[240px]">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-paper/55">
            {t("eyebrow")}
          </p>
          <p className="mt-1 text-base font-semibold text-paper sm:text-lg">
            {t("body")}{" "}
            <span className="text-primary">— {t("comingSoon")}.</span>
          </p>
        </div>

        <button
          type="button"
          disabled
          className="ms-auto inline-flex items-center gap-2 rounded-full bg-paper/10 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-paper/60"
        >
          {t("cta")}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
