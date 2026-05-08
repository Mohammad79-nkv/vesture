import { getTranslations } from "next-intl/server";
import { ArrowRight, Check, ShoppingBag, Sparkles } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import type { OutfitScore } from "@/lib/services/outfit";

// Score panel for /closet/styles/[id]. Server component because the
// score is already persisted on SavedOutfit and we just present it.
// Mirrors frame 06b: dark verdict card with composite score, three
// sub-score rings, "What's working" greens, "What to try" suggestions.
//
// Props are loose: SavedOutfit's AI columns are nullable, so callers
// pass null when nothing's been scored yet and we render nothing —
// the parent shows the OutfitScoreButton as the CTA instead.

export async function OutfitScorePanel({ score }: { score: OutfitScore }) {
  const t = await getTranslations("closetScore");
  const tSlot = await getTranslations("outfit.slots");

  // Sub-score colors mirror the design's rings: harmony teal, fit amber,
  // occasion deep teal. Tuned by tone, not by value.
  const SUB_HUE = {
    harmony: "#34889E",
    fit: "#C97A0E",
    occasion: "#256776",
  } as const;

  return (
    <section className="mt-4 flex flex-col gap-4">
      {/* Verdict card — dark gradient with composite score */}
      <div
        className="relative overflow-hidden rounded-3xl p-5"
        style={{
          background:
            "linear-gradient(180deg, #212739 0%, #3A4055 100%)",
        }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper/55">
          {t("verdict")}
        </p>
        <h2 className="mt-2 text-[28px] font-bold leading-[1.1] tracking-[-0.02em] text-paper">
          {score.verdict.headline}
        </h2>
        <p className="mt-2 max-w-[320px] text-[13.5px] leading-[1.5] text-paper/70">
          {score.verdict.body}
        </p>
        <div className="mt-5 flex items-baseline gap-2">
          <span className="font-mono text-[48px] font-bold leading-none tracking-[-0.02em] text-paper">
            {score.composite}
          </span>
          <span className="font-mono text-[12px] text-paper/55">
            {t("composite")}
          </span>
          <span className="ms-2 rounded-full bg-paper/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-paper">
            {t(`labels.${score.label}`)}
          </span>
        </div>
      </div>

      {/* Sub-score rings */}
      <div className="grid grid-cols-3 gap-2">
        {(["harmony", "fit", "occasion"] as const).map((key) => (
          <ScoreRing
            key={key}
            label={t(`subScores.${key}`)}
            value={score.subScores[key]}
            hue={SUB_HUE[key]}
          />
        ))}
      </div>

      {/* What's working */}
      <div>
        <p className="px-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
          {t("whatWorking")}
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {score.whatWorking.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 rounded-2xl bg-[#DCEDF1] p-3"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#256776] text-paper"
              >
                <Check size={11} strokeWidth={3} />
              </span>
              <p className="text-[13px] leading-[1.4] text-[#1d4d56]">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* What to try */}
      <div>
        <p className="px-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
          {t("whatToTry")}
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {score.whatToTry.map((item, i) => {
            if (item.kind === "swap") {
              return (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-2xl bg-primary/10 p-3"
                >
                  <span
                    aria-hidden="true"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-paper"
                  >
                    <Sparkles size={14} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-tight text-primary">
                      {item.suggestion}
                    </p>
                    <p className="mt-0.5 font-mono text-[10.5px] text-ink/55">
                      {t("harmonyDelta", {
                        from: score.subScores.harmony,
                        to: item.harmonyDelta,
                      })}
                      {" · "}
                      {tSlot(item.targetCategory)}
                      {" · "}
                      <span className="text-primary">{t("fromYourCloset")}</span>
                    </p>
                  </div>
                </li>
              );
            }
            return (
              <li
                key={i}
                className="flex items-center gap-3 rounded-2xl bg-[#FFF1D6] p-3"
              >
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#C97A0E] text-paper"
                >
                  <ShoppingBag size={14} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-tight text-[#7A5410]">
                    {item.suggestion}
                  </p>
                  <p className="mt-0.5 font-mono text-[10.5px] text-[#7A5410]/75">
                    {item.deltaHint} · {tSlot(item.targetCategory)}
                  </p>
                </div>
                <Link
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  href={(`/products?category=${categoryToProductCategory(item.targetCategory)}` as any)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#C97A0E] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-paper hover:bg-[#a96808]"
                >
                  {t("shopSuggestion")}
                  <ArrowRight size={11} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function ScoreRing({
  label,
  value,
  hue,
}: {
  label: string;
  value: number;
  hue: string;
}) {
  // SVG ring — circumference 2π * 28 ≈ 175.93. The design uses 5px stroke
  // with 64px diameter; we scale to 72 for a slightly bigger touch target.
  const RADIUS = 30;
  const CIRC = 2 * Math.PI * RADIUS;
  const offset = CIRC * (1 - Math.max(0, Math.min(100, value)) / 100);

  return (
    <div className="flex flex-col items-center rounded-2xl bg-paper p-3 text-center">
      <div className="relative h-[72px] w-[72px]">
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
          <circle
            cx="36"
            cy="36"
            r={RADIUS}
            stroke="rgba(33,39,57,0.08)"
            strokeWidth="5"
            fill="none"
          />
          <circle
            cx="36"
            cy="36"
            r={RADIUS}
            stroke={hue}
            strokeWidth="5"
            fill="none"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 36 36)"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-mono text-[18px] font-bold leading-none tracking-[-0.01em] text-ink">
            {value}
          </span>
        </div>
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
        {label}
      </p>
    </div>
  );
}

// Phase 3A used the simplified slot vocabulary (TOP / BOTTOM / DRESS /
// OUTER / SHOES / BAG / ACCESSORY); the public catalog still uses
// Prisma's plural Category enum (TOPS / BOTTOMS / …). Map between them
// when generating shop links.
function categoryToProductCategory(slot: string): string {
  switch (slot) {
    case "TOP":
      return "TOPS";
    case "BOTTOM":
      return "BOTTOMS";
    case "DRESS":
      return "DRESSES";
    case "OUTER":
      return "OUTERWEAR";
    case "SHOES":
      return "SHOES";
    case "BAG":
      return "BAGS";
    case "ACCESSORY":
      return "ACCESSORIES";
    default:
      return "TOPS";
  }
}
