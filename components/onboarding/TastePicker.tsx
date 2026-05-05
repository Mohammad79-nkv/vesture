"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { saveTasteAction } from "@/app/[locale]/onboarding/actions";
import { STYLE_TAGS, type StyleTag } from "@/lib/domain/styleTags";

const SWATCHES: Record<StyleTag, string> = {
  STREETWEAR: "#212739",
  QUIET_LUXURY: "#C9CDD6",
  MINIMAL: "#E6E9EE",
  ROMANTIC: "#F291BB",
  TAILORED: "#3A4055",
  EDITORIAL: "#34889E",
};

const stripes =
  "repeating-linear-gradient(135deg, rgba(33,39,57,0.05) 0 1px, transparent 1px 9px)";

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
              <span
                aria-hidden="true"
                className="block h-[130px] rounded-xl"
                style={{
                  background: SWATCHES[tag],
                  backgroundImage: stripes,
                }}
              />
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
