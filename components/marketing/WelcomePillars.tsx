import { getTranslations } from "next-intl/server";
import { Sparkles, LayoutGrid, Eye, AtSign, ArrowRight, Package } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";

// Four-pillar grid + seller band from the design's welcome page. Glass cards
// (white/5 bg + white/10 border + backdrop-blur) on the dark navy backdrop.
export async function WelcomePillars() {
  const t = await getTranslations("welcome");

  const pillars = [
    {
      n: "01",
      Icon: Sparkles,
      accent: "#F291BB",
      title: t("p1Title"),
      body: t("p1Body"),
      tag: t("p1Tag"),
      demo: <DemoChips a={t("p1Demo1")} b={t("p1Demo2")} />,
    },
    {
      n: "02",
      Icon: LayoutGrid,
      accent: "#9DCAD4",
      title: t("p2Title"),
      body: t("p2Body"),
      tag: t("p2Tag"),
      demo: <DemoMasonry />,
    },
    {
      n: "03",
      Icon: Eye,
      accent: "#CD0268",
      title: t("p3Title"),
      body: t("p3Body"),
      tag: t("p3Tag"),
      demo: <DemoSwatchGrid />,
    },
    {
      n: "04",
      Icon: AtSign,
      accent: "#9DCAD4",
      title: t("p4Title"),
      body: t("p4Body"),
      tag: t("p4Tag"),
      demo: <DemoHandles />,
    },
  ];

  return (
    <section className="relative bg-ink text-paper">
      <div className="mx-auto w-full max-w-7xl px-6 pb-16 pt-16 sm:px-10 lg:px-16 lg:pb-16 lg:pt-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-paper/50">
              {t("pillarsEyebrow")}
            </p>
            <h2 className="mt-2 text-[32px] font-bold leading-none tracking-[-0.03em] text-paper sm:text-[44px]">
              {t("pillarsHeadlineLead")}{" "}
              <span className="font-light text-[#F291BB]">{t("pillarsHeadlineAccent")}</span>.
            </h2>
          </div>
          <p className="max-w-[280px] font-mono text-[11px] tracking-[0.04em] text-paper/40 lg:text-end">
            {t("pillarsSubtitle")}
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p) => (
            <li
              key={p.n}
              className="flex min-h-[280px] flex-col gap-3 rounded-[18px] border border-paper/10 bg-paper/5 p-5 backdrop-blur"
            >
              <div className="flex items-start justify-between">
                <span
                  className="grid h-9 w-9 place-items-center rounded-[10px]"
                  style={{
                    backgroundColor: `${p.accent}22`,
                    color: p.accent,
                  }}
                >
                  <p.Icon size={18} aria-hidden="true" />
                </span>
                <span
                  className="rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em]"
                  style={{
                    backgroundColor: `${p.accent}15`,
                    color: p.accent,
                  }}
                >
                  {p.tag}
                </span>
              </div>

              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper/40">
                  {p.n}
                </p>
                <h3 className="mt-0.5 text-[20px] font-bold leading-tight tracking-[-0.02em] text-paper sm:text-[22px]">
                  {p.title}
                </h3>
                <p className="mt-2 text-[12.5px] leading-snug text-paper/65">{p.body}</p>
              </div>

              <div className="mt-auto rounded-[10px] border border-paper/5 bg-black/20 p-2.5">
                {p.demo}
              </div>
            </li>
          ))}
        </ul>

        {/* Seller band */}
        <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-paper/8 bg-paper/[0.04] px-6 py-5">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#F291BB]/15 text-[#F291BB]"
          >
            <Package size={16} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-paper/50">
              {t("sellerEyebrow")}
            </p>
            <p className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-paper">
              {t.rich("sellerHeadline", {
                hashtag: (chunks) => (
                  <span className="text-[#F291BB]">{chunks}</span>
                ),
              })}
            </p>
          </div>
          <span className="ms-auto hidden font-mono text-[11px] uppercase tracking-[0.08em] text-paper/55 lg:inline">
            {t("sellerFeatures")}
          </span>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-paper hover:text-[#F291BB]"
          >
            {t("sellerCta")} <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Mini demos (decorative content inside each pillar's bottom panel) ──

function DemoChips({ a, b }: { a: string; b: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="self-start rounded-full bg-paper/10 px-2 py-1 font-mono text-[9.5px] tracking-[0.06em] text-[#F291BB]">
        “{a}”
      </span>
      <span className="self-end rounded-full bg-paper/[0.06] px-2 py-1 font-mono text-[9.5px] text-paper/55">
        {b}
      </span>
    </div>
  );
}

function DemoMasonry() {
  const cells = ["#34889E", "#3A4055", "#F291BB", "#C9CDD6", "#212739", "#9DCAD4"];
  return (
    <div className="grid grid-cols-3 gap-1" style={{ gridAutoRows: "30px" }}>
      {cells.map((c, i) => (
        <div
          key={i}
          className="rounded"
          style={{ background: c, gridRow: i % 2 ? "span 2" : "span 1" }}
        />
      ))}
    </div>
  );
}

function DemoSwatchGrid() {
  const swatches = [
    "#212739", "#C9CDD6", "#3A4055", "#DCEDF1",
    "#7A013D", "#E6E9EE", "#F291BB", "#5E6478",
  ];
  return (
    <div className="grid grid-cols-4 gap-[3px]">
      {swatches.map((c, i) => (
        <div
          key={i}
          className="h-[26px] rounded-[3px] opacity-85"
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

function DemoHandles() {
  const handles = ["@oromora.atelier", "@maisoncerise", "@nilou.thread"];
  return (
    <div className="flex flex-col gap-1">
      {handles.map((h) => (
        <div
          key={h}
          className="flex items-center gap-1.5 font-mono text-[10px] text-paper/70"
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-secondary"
          />
          {h}
        </div>
      ))}
    </div>
  );
}
