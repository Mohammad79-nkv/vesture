import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";

// Desktop sidebar on /products that nudges visitors toward the live
// stylist. Replaces the Phase-1 "Coming soon" placeholder now that the
// chat at /stylist actually works.
export async function StylistSidebar() {
  const t = await getTranslations("stylist");
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 overflow-hidden rounded-2xl bg-ink p-5 text-paper shadow-[0_2px_30px_rgba(33,39,57,0.06)]">
        <div className="mb-5 flex items-start gap-3">
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
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-paper/55">
              {t("status")}
            </p>
            <p className="mt-0.5 text-base font-semibold text-paper">{t("title")}</p>
          </div>
        </div>

        <p className="text-[13.5px] leading-[1.55] text-paper/70">
          {t("sidebarTeaser")}
        </p>

        <Link
          href="/stylist"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-paper transition-colors hover:bg-primary/90"
        >
          {t("sidebarOpen")}
          <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
