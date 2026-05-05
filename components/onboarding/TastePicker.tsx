"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { saveTasteAction } from "@/app/[locale]/onboarding/actions";
import { STYLE_TAGS, type StyleTag } from "@/lib/domain/styleTags";

// Each card layers a real fashion photo over a brand-colored swatch. The
// swatch stays visible while the photo is loading and as a fallback if the
// CDN URL ever 404s — we don't want a broken-image icon on the onboarding
// path. Photos are hand-picked from Unsplash and chosen to convey the
// aesthetic at a glance (palette, vibe, silhouette). Swap freely.
type StyleVisual = { swatch: string; image: string; alt: string };

const VISUALS: Record<StyleTag, StyleVisual> = {
  STREETWEAR: {
    swatch: "#212739",
    image:
      "https://images.unsplash.com/photo-1556906781-9a412961c28c?w=480&q=85&auto=format&fit=crop",
    alt: "Streetwear lookbook — oversized layers, sneakers, urban",
  },
  QUIET_LUXURY: {
    swatch: "#C9CDD6",
    image:
      "https://images.unsplash.com/photo-1581338834647-b0fb40704e21?w=480&q=85&auto=format&fit=crop",
    alt: "Tonal beige outfit — cashmere, camel, refined",
  },
  MINIMAL: {
    swatch: "#E6E9EE",
    image:
      "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=480&q=85&auto=format&fit=crop",
    alt: "Minimalist look — white shirt, clean silhouette, neutral",
  },
  ROMANTIC: {
    swatch: "#F291BB",
    image:
      "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=480&q=85&auto=format&fit=crop",
    alt: "Romantic look — soft pink, lace, dreamy lighting",
  },
  TAILORED: {
    swatch: "#3A4055",
    image:
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=480&q=85&auto=format&fit=crop",
    alt: "Tailored look — structured blazer, sharp lines",
  },
  EDITORIAL: {
    swatch: "#34889E",
    image:
      "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=480&q=85&auto=format&fit=crop",
    alt: "Editorial portrait — high-fashion pose, magazine cover",
  },
};

const MIN_PICKS = 2;

// Frame 03 · OBTaste — pick at least 2 styles. Picks land on User.styleTags
// and User.onboardedAt = now(), unlocking the auth-gated buyer surfaces
// (closet, me, stylist, favorites) that the requireOnboarded() gate guards.
export function TastePicker({ initial }: { initial: StyleTag[] }) {
  const t = useTranslations("onboardingTaste");
  const [picked, setPicked] = useState<Set<StyleTag>>(new Set(initial));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(tag: StyleTag) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function submit() {
    if (picked.size < MIN_PICKS) return;
    setError(null);
    startTransition(async () => {
      try {
        await saveTasteAction({ styleTags: Array.from(picked) });
      } catch (err) {
        // Server action redirects on success — let NEXT_REDIRECT propagate.
        if (err && typeof err === "object" && "digest" in err) throw err;
        setError(t("errors.saveFailed"));
      }
    });
  }

  const canContinue = picked.size >= MIN_PICKS;

  return (
    <div className="flex flex-1 flex-col">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
        {t("step")}
      </p>
      <h1 className="mt-1.5 text-[30px] font-bold leading-none tracking-[-0.02em] text-ink">
        {t("headline")}
        <br />
        <span className="font-light text-primary">{t("headlineAccent")}</span>.
      </h1>
      <p className="mt-3 max-w-[320px] text-[13px] text-ink-soft">
        {t("body")}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2.5">
        {STYLE_TAGS.map((tag) => {
          const on = picked.has(tag);
          const visual = VISUALS[tag];
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              aria-pressed={on}
              className={[
                "relative flex flex-col rounded-2xl bg-paper p-1.5 text-start transition-all",
                on
                  ? "ring-2 ring-primary"
                  : "shadow-[inset_0_0_0_1px_rgba(33,39,57,0.06)] hover:shadow-[inset_0_0_0_1px_rgba(33,39,57,0.18)]",
              ].join(" ")}
            >
              {/* Image layered over the brand swatch — the swatch shows
                 through while the photo loads or if it fails. */}
              <span
                className="relative block h-[130px] overflow-hidden rounded-xl"
                style={{ background: visual.swatch }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={visual.image}
                  alt={visual.alt}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="mt-2 flex items-center justify-between px-1 pb-1">
                <span className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
                  {t(`styles.${tag}`)}
                </span>
                <span
                  className={[
                    "grid h-5 w-5 place-items-center rounded-full transition-colors",
                    on ? "bg-primary text-paper" : "bg-ink/[0.06] text-transparent",
                  ].join(" ")}
                >
                  {on && <Check size={11} strokeWidth={3} aria-hidden="true" />}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

      <div className="mt-auto flex items-center gap-3 pt-6 pb-6">
        <p className="flex-1 font-mono text-[11px] text-ink/55">
          {canContinue
            ? t("selected", { n: picked.size })
            : t("selectMore")}
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={!canContinue || pending}
          className="inline-flex h-[50px] items-center justify-center gap-2 rounded-2xl bg-ink px-6 text-[12px] font-semibold uppercase tracking-[0.06em] text-paper disabled:bg-ink/15"
        >
          {pending ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              {t("saving")}
            </>
          ) : (
            <>
              {t("continue")}
              <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
