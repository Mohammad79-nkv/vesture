import { getTranslations } from "next-intl/server";

// Placeholder until the AI stylist ships in Phase 2. Same panel chrome as the
// final design (header with status + close affordance) so layout doesn't shift
// when the live version replaces this one.
export async function StylistSidebar() {
  const t = await getTranslations("stylist");
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 rounded-2xl bg-paper p-5 shadow-[0_2px_30px_rgba(33,39,57,0.06)]">
        <div className="mb-6 flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-paper"
          >
            <svg
              width="16"
              height="16"
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
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/55">
              {t("status")}
            </p>
            <p className="mt-0.5 text-base font-semibold text-ink">{t("title")}</p>
          </div>
          <button
            type="button"
            disabled
            aria-label="Close"
            className="text-ink/40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="rounded-xl bg-mist p-6 text-center">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            {t("comingSoon")}
          </p>
          <p className="text-sm leading-relaxed text-ink/70">
            {t("comingSoonBody")}
          </p>
        </div>
      </div>
    </aside>
  );
}
