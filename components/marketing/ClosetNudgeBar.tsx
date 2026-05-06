"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Sparkles } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";

const DISMISS_KEY = "vesture:closet-nudge-dismissed";

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    // sessionStorage can throw in private/locked-down contexts; treat as
    // not-dismissed so the prompt still surfaces.
    return false;
  }
}

// Dark closet-nudge card from Frame 05 (OBFirstHome). Replaces the simpler
// "Tell me what you're after" stylist bar at the top of /products mobile
// when the user has zero closet pieces. Tapping "Later" dismisses for the
// session — sessionStorage so it comes back on a fresh tab and the user
// isn't permanently hidden from the prompt.
//
// We adapt the design's 4-step progress (account/taste/permissions/closet)
// to our actual 3-step flow since Frame 04 was skipped.
export function ClosetNudgeBar() {
  const t = useTranslations("closetNudge");
  // Lazy init so the SSR pass renders the bar (sessionStorage isn't
  // available there), and the client immediately reads the dismissal flag
  // on first render — avoiding a flash and the linter's set-state-in-effect
  // warning we'd hit with a useEffect approach.
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed) return null;

  return (
    <section
      aria-label={t("addMyCloset")}
      className="relative overflow-hidden rounded-[22px] bg-ink p-4 text-paper shadow-[0_12px_32px_rgba(33,39,57,0.18)]"
    >
      {/* Magenta ambient glow in the corner */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -end-10 -top-10 h-[180px] w-[180px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(205,2,104,0.65) 0%, rgba(205,2,104,0) 70%)",
        }}
      />

      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-paper/55">
            {t("eyebrow")}
          </p>
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-full bg-primary text-paper"
          >
            <Sparkles size={13} aria-hidden="true" />
          </span>
        </div>

        <p className="mt-2 text-[24px] font-bold leading-[1.05] tracking-[-0.02em]">
          {t("headlineLead")}{" "}
          <span className="font-light text-[#F291BB]">
            {t("headlineAccent")}
          </span>
          .
        </p>

        {/* 3-step progress: account ✓ taste ✓ closet (empty) */}
        <div className="mt-3.5 grid grid-cols-3 gap-1">
          <span className="h-1 rounded-full bg-[#F291BB]" />
          <span className="h-1 rounded-full bg-[#F291BB]" />
          <span className="h-1 rounded-full bg-paper/[0.18]" />
        </div>
        <p className="mt-1.5 font-mono text-[10px] text-paper/55">
          {t("stepAccount")} · {t("stepTaste")} ·{" "}
          <span className="text-[#F291BB]">{t("stepCloset")}</span>
        </p>

        <div className="mt-3.5 flex gap-2">
          <Link
            href="/closet"
            className="inline-flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-paper text-[12px] font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:bg-paper/90"
          >
            <Plus size={14} strokeWidth={2} aria-hidden="true" />
            {t("addMyCloset")}
          </Link>
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              try {
                sessionStorage.setItem(DISMISS_KEY, "1");
              } catch {
                // sessionStorage can throw in private/locked-down contexts; OK
                // to silently no-op since the dismissal is best-effort.
              }
            }}
            className="inline-flex h-[46px] items-center justify-center rounded-[14px] border border-paper/[0.18] bg-transparent px-4 text-[11px] tracking-[0.04em] text-paper/70 hover:border-paper/40 hover:text-paper"
          >
            {t("later")}
          </button>
        </div>
      </div>
    </section>
  );
}
