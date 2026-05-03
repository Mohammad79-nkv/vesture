import { getTranslations } from "next-intl/server";
import { ArrowRight, Package } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { EditorialCollage } from "./EditorialCollage";
import { LiveStylistDemo } from "./LiveStylistDemo";

// Welcome hero — dark navy stage with editorial collage backdrop, the four-line
// "Tell us how you want to feel" headline (102px desktop / 46px mobile per the
// design), CTAs, and the live AI stylist demo card on the right (desktop only;
// mobile gets the dense two-line CTA stack from OBWelcome).
export async function WelcomeHero() {
  const t = await getTranslations("welcome");

  return (
    <section className="relative overflow-hidden bg-ink text-paper">
      {/* Desktop uses radial overlay; mobile uses a vertical fade. The wrapping
         section is the same — both collages are stacked, only one is visible
         per breakpoint. */}
      <div className="hidden lg:block">
        <EditorialCollage variant="desktop" overlay="radial" />
      </div>
      <div className="lg:hidden">
        <EditorialCollage variant="mobile" overlay="vertical" />
      </div>

      {/* Top bar */}
      <div className="relative flex items-center gap-5 px-6 pt-8 sm:px-10 lg:px-16 lg:pt-8">
        <Link
          href="/"
          className="shrink-0 font-bold tracking-[0.18em] text-paper text-[13px] sm:text-[15px] lg:text-base"
        >
          VESTURE
        </Link>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-paper/50 sm:inline">
          {t("tagline")}
        </span>
        <span className="ms-auto font-mono text-[9px] uppercase tracking-[0.14em] text-paper/50 lg:hidden">
          {t("mobileTopRight", { n: 14 })}
        </span>

        <nav className="ms-auto hidden items-center gap-6 lg:flex">
          <span className="text-[12.5px] tracking-[-0.01em] text-paper/70">
            {t("navHowItWorks")}
          </span>
          <span className="text-[12.5px] tracking-[-0.01em] text-paper/70">
            {t("navForSellers")}
          </span>
          <span className="text-[12.5px] tracking-[-0.01em] text-paper/70">
            {t("navEditorial")}
          </span>
          <Link
            href="/sign-in"
            className="ms-4 text-[12px] tracking-[0.04em] text-paper/70 hover:text-paper"
          >
            {t("iHaveAccount")}
          </Link>
        </nav>
      </div>

      {/* HERO grid */}
      <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-6 pt-10 sm:px-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14 lg:px-16 lg:pt-10">
        <div className="flex flex-col">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#F291BB] sm:text-[11px] sm:tracking-[0.18em]">
            <span className="lg:hidden">{t("mobileEyebrow")}</span>
            <span className="hidden lg:inline">{t("eyebrow", { n: 14 })}</span>
          </p>

          <h1 className="mt-3 text-[46px] font-bold leading-[0.94] tracking-[-0.035em] text-paper sm:text-[64px] lg:mt-5 lg:text-[88px] lg:leading-[0.92] xl:text-[102px]">
            {t("headlineLine1")}
            <br />
            {t("headlineLine2")}{" "}
            <span className="font-light text-[#F291BB]">{t("headlineAccent1")}</span>.
            <br />
            {t("headlineLine3")}{" "}
            <span className="font-light text-[#9DCAD4]">{t("headlineAccent2")}</span>
            <br />
            {t("headlineLine4")}.
          </h1>

          <p className="mt-4 max-w-[330px] text-[13.5px] leading-[1.55] text-paper/[0.78] lg:mt-6 lg:max-w-[520px] lg:text-[17px]">
            <span className="lg:hidden">{t("descriptionShort")}</span>
            <span className="hidden lg:inline">{t("description")}</span>
          </p>

          {/* Desktop CTAs — primary paper button + glass "I'm a seller" + meta */}
          <div className="mt-9 hidden flex-wrap items-center gap-3 lg:flex">
            <Link
              href="/stylist"
              className="inline-flex h-14 items-center gap-2.5 rounded-[18px] bg-paper px-7 text-[13px] font-bold uppercase tracking-[0.06em] text-ink transition-colors hover:bg-paper/90"
            >
              {t("ctaStart")}
              <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-14 items-center gap-2 rounded-[18px] border border-paper/20 bg-paper/[0.08] px-6 text-[13px] font-semibold tracking-[0.04em] text-paper transition-colors hover:bg-paper/[0.12]"
            >
              <Package size={14} aria-hidden="true" />
              {t("ctaImSeller")}
            </Link>
            <span className="font-mono text-[11px] tracking-[0.08em] text-paper/55">
              {t("freeSetup")}
            </span>
          </div>

          {/* Trust bar */}
          <div className="mt-6 flex flex-wrap gap-x-7 gap-y-4 lg:mt-10 lg:gap-x-8">
            <Stat n="3,200" l={t("trustSellers")} />
            <Stat n="98,400" l={t("trustPieces")} />
            <Stat n="12" l={t("trustCities")} />
            <Stat n="FA/EN" l={t("trustBilingual")} />
          </div>
        </div>

        {/* RIGHT — live demo (desktop only; mobile gets the 4-pillar grid below
           in WelcomePillars, which already handles 2x2 at sm breakpoints) */}
        <div className="hidden lg:block lg:pt-2">
          <LiveStylistDemo />
        </div>

        {/* Mobile sticky-style CTAs (in-flow, not actually sticky — the design's
           sticky variant fights with the page scroll under the bottom nav) */}
        <div className="flex flex-col gap-1.5 pb-4 lg:hidden">
          <Link
            href="/stylist"
            className="inline-flex h-[52px] items-center justify-center gap-2 rounded-[18px] bg-paper text-[13px] font-bold uppercase tracking-[0.06em] text-ink"
          >
            {t("ctaStart")}
            <ArrowRight size={13} strokeWidth={2.2} aria-hidden="true" />
          </Link>
          <div className="flex gap-1.5">
            <Link
              href="/sign-in"
              className="inline-flex h-10 flex-1 items-center justify-center rounded-[14px] border border-paper/15 bg-paper/[0.06] text-[11px] tracking-[0.04em] text-paper/85"
            >
              {t("iHaveAccount")}
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[14px] border border-paper/10 bg-transparent text-[11px] tracking-[0.04em] text-paper/65"
            >
              <Package size={11} aria-hidden="true" />
              {t("ctaImSeller")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <p className="text-[16px] font-bold tracking-[-0.02em] text-paper sm:text-[20px] lg:text-[22px]">
        {n}
      </p>
      <p className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-paper/50 lg:text-[10px]">
        {l}
      </p>
    </div>
  );
}
