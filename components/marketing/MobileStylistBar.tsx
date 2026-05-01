import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";

// Mobile-only promo strip surfacing the AI stylist. Wired to /stylist which
// currently renders a "Coming soon" page until Phase 2 lands the live agent.
export async function MobileStylistBar({ sellerCount }: { sellerCount: number }) {
  const t = await getTranslations("stylist");
  return (
    <Link
      href="/stylist"
      className="flex items-center gap-3 rounded-2xl bg-ink p-4 text-paper hover:bg-ink/90 lg:hidden"
    >
      <span
        aria-hidden="true"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-paper"
      >
        <svg
          width="18"
          height="18"
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
      <div className="flex-1 leading-tight">
        <p className="text-base font-semibold">{t("promoTitle")}</p>
        <p className="mt-0.5 text-xs text-paper/65">
          {t("promoSubtitle", { count: sellerCount.toLocaleString() })}
        </p>
      </div>
      <span aria-hidden="true" className="shrink-0 text-paper/80">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </span>
    </Link>
  );
}
