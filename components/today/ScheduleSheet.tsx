"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Loader2, X } from "lucide-react";
import { cloudinaryUrl } from "@/lib/domain/cloudinary-url";
import { scheduleOutfitAction } from "@/app/[locale]/(shop)/today/actions";
import type { TodayOutfit } from "@/lib/services/today-cache";
import type { TodayPiece } from "@/lib/services/today-recommender";
import type { OutfitSlot } from "@/lib/domain/outfit-slots";
import type { TimeOfDay } from "@prisma/client";

// Frame 10 · Schedule outfit to calendar.
//
// Triggered from the Why sheet. Fullscreen-style sheet (matches
// frame 10 dimensions): outfit preview chip at the top, 14-day
// grid below with day-of-week labels, time-of-day segmented
// selector, optional occasion text input, big "Schedule for X"
// CTA pinned at the bottom.
//
// We surface ±0 to +13 days from "today" (UTC). Day cells show
// dot indicators when the user already has a ScheduledOutfit
// for that day (passed in via `existingDates`), but conflict
// resolution is allow-multiple for v1.

const TIME_SLOTS: TimeOfDay[] = ["MORNING", "AFTERNOON", "EVENING"];

export function ScheduleSheet({
  open,
  onClose,
  outfit,
  pieces,
  existingDates,
  onScheduled,
}: {
  open: boolean;
  onClose: () => void;
  outfit: TodayOutfit | undefined;
  pieces: Map<string, TodayPiece>;
  // ISO date strings (yyyy-mm-dd) that already have a schedule —
  // drives the dot indicator on calendar cells.
  existingDates: Set<string>;
  onScheduled: (scheduledOutfitId: string) => void;
}) {
  const t = useTranslations("today.schedule");

  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [timeSlot, setTimeSlot] = useState<TimeOfDay>("EVENING");
  const [occasion, setOccasion] = useState("");
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset transient state on open.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setSelectedIso(null);
      setTimeSlot("EVENING");
      setOccasion("");
      setErrorMsg(null);
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  // ESC + body-scroll lock.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Build the 14-day grid starting from today UTC.
  const days = useMemo(() => {
    const today = new Date();
    const utcMidnight = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(utcMidnight);
      d.setUTCDate(d.getUTCDate() + i);
      return d;
    });
  }, []);

  const todayIso = days[0]?.toISOString().slice(0, 10);
  const dayLabels = useMemo(() => {
    // Use Intl to localise the day-letter labels. Show the FIRST
    // 7 days' weekday so the columns align with the 14-day grid.
    return days.slice(0, 7).map((d) =>
      d
        .toLocaleDateString(undefined, { weekday: "narrow" })
        .toUpperCase(),
    );
  }, [days]);

  // First-row offset so day 0 (today) lands under its day-of-week
  // column. The grid is exactly 14 days wrapped to 2 rows of 7.

  function handleSchedule() {
    if (!outfit || !selectedIso) {
      setErrorMsg(t("errors.pickDay"));
      return;
    }
    setErrorMsg(null);
    startTransition(async () => {
      const res = await scheduleOutfitAction({
        scheduledFor: selectedIso,
        timeOfDay: timeSlot,
        pieces: outfit.pieces.map((p) => ({
          slot: p.slot as OutfitSlot,
          pieceId: p.pieceId,
        })),
        name: outfit.name,
        occasion: occasion.trim() || undefined,
      });
      if (res.ok) {
        onScheduled(res.scheduledOutfitId);
        onClose();
      } else {
        setErrorMsg(t("errors.failed"));
      }
    });
  }

  const ctaLabel = useMemo(() => {
    if (!selectedIso) return t("cta.placeholder");
    const d = new Date(`${selectedIso}T12:00:00Z`);
    const day = d.toLocaleDateString(undefined, { weekday: "short" });
    const date = d.getUTCDate();
    return t("cta.scheduleFor", { day, date });
  }, [selectedIso, t]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("dialogLabel")}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-mist text-ink"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
          {t("kicker")}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="grid h-9 w-9 place-items-center rounded-full bg-paper text-ink/70"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Outfit preview */}
      <div className="px-4 pt-3">
        {outfit ? (
          <div className="flex items-center gap-3 rounded-[18px] bg-ink p-3 text-paper">
            <div className="flex shrink-0 gap-[3px]">
              {outfit.pieces.slice(0, 3).map((p) => {
                const piece = pieces.get(p.pieceId);
                if (!piece) return null;
                return (
                  <div
                    key={p.pieceId}
                    className="h-[44px] w-[30px] overflow-hidden rounded-[6px]"
                    style={{ background: piece.swatchHex ?? "#3A4055" }}
                  >
                    {piece.publicId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cloudinaryUrl(piece.publicId, 100)}
                        alt={piece.name ?? piece.category}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold tracking-[-0.01em]">
                {outfit.name}
              </p>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-paper/55">
                {t("preview", { count: outfit.pieces.length })}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Calendar grid */}
      <div className="px-5 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
          {t("pickDay")}
        </p>
        <div className="mt-3.5">
          <div className="mb-1.5 grid grid-cols-7 gap-1">
            {dayLabels.map((label, i) => (
              <p
                key={i}
                className="text-center font-mono text-[9px] tracking-[0.1em] text-ink/55"
              >
                {label}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              const iso = d.toISOString().slice(0, 10);
              const isToday = iso === todayIso;
              const isSelected = iso === selectedIso;
              const hasOutfit = existingDates.has(iso);
              const dateNum = d.getUTCDate();
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedIso(iso)}
                  className={[
                    "relative flex aspect-square flex-col items-center justify-center rounded-[12px] text-[14px] tracking-[-0.02em] transition-colors",
                    isSelected
                      ? "border-[2px] border-primary bg-ink font-bold text-paper"
                      : isToday
                        ? "bg-primary/15 font-bold text-ink"
                        : "border border-ink/[0.04] bg-paper font-medium text-ink",
                  ].join(" ")}
                  aria-pressed={isSelected}
                  aria-label={d.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                >
                  <span>{dateNum}</span>
                  {hasOutfit && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-1.5 h-1 w-1 rounded-full"
                      style={{
                        background: isSelected ? "#F291BB" : "#34889E",
                      }}
                    />
                  )}
                  {/* Hint label — also show day-of-week below the
                      number for the first row only (compact). */}
                  {i < 7 ? null : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Time of day */}
      <div className="px-4 pt-5">
        <div className="flex rounded-[16px] bg-paper p-1">
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setTimeSlot(slot)}
              className={[
                "flex-1 rounded-[12px] py-2.5 text-[12px] font-medium tracking-[-0.01em] transition-colors",
                timeSlot === slot
                  ? "bg-ink font-semibold text-paper"
                  : "text-ink",
              ].join(" ")}
            >
              {t(`time.${slot}`)}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          placeholder={t("occasionPlaceholder")}
          maxLength={60}
          className="mt-2.5 h-12 w-full rounded-[14px] bg-paper px-4 text-[13px] text-ink shadow-[inset_0_0_0_1px_rgba(33,39,57,0.06)] outline-none focus:shadow-[inset_0_0_0_1.5px_rgba(205,2,104,0.5)]"
        />
        {errorMsg && (
          <p className="mt-2 text-[12px] text-red-600">{errorMsg}</p>
        )}
      </div>

      {/* CTA */}
      <div className="mt-auto px-4 py-7">
        <button
          type="button"
          onClick={handleSchedule}
          disabled={!selectedIso || pending}
          className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-ink text-[13px] font-semibold uppercase tracking-[0.06em] text-paper disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              {t("scheduling")}
            </>
          ) : (
            <>
              {ctaLabel}
              <ArrowRight size={14} aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
