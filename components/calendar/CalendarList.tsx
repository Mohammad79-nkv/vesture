"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import { cloudinaryUrl } from "@/lib/domain/cloudinary-url";
import { unscheduleOutfitAction } from "@/app/[locale]/(shop)/today/actions";
import type { TimeOfDay } from "@prisma/client";

// Phase 3E.7 · Read-only calendar list.
//
// Groups schedules into Today / Upcoming / Recent and renders
// each as a card with the outfit thumbs + time-of-day pill +
// occasion. A small trash button on each card unschedules.

type Schedule = {
  id: string;
  scheduledFor: string; // ISO
  timeOfDay: TimeOfDay;
  name: string | null;
  occasion: string | null;
  pieces: Array<{ slot: string; pieceId: string }>;
};

type Piece = {
  id: string;
  name: string | null;
  category: string;
  color: string | null;
  swatchHex: string | null;
  publicId: string;
  imageUrl: string;
};

export function CalendarList({
  schedules,
  pieces,
}: {
  schedules: Schedule[];
  pieces: Piece[];
}) {
  const t = useTranslations("calendar");
  const tTime = useTranslations("today.schedule.time");
  const [optimisticRemoved, setOptimisticRemoved] = useState<Set<string>>(
    new Set(),
  );
  const [, startTransition] = useTransition();

  const pieceMap = useMemo(
    () => new Map(pieces.map((p) => [p.id, p])),
    [pieces],
  );

  const visible = schedules.filter((s) => !optimisticRemoved.has(s.id));

  const todayIso = useMemo(() => {
    const d = new Date();
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    )
      .toISOString()
      .slice(0, 10);
  }, []);

  const groups = useMemo(() => {
    const today: Schedule[] = [];
    const upcoming: Schedule[] = [];
    const past: Schedule[] = [];
    for (const s of visible) {
      const dayIso = s.scheduledFor.slice(0, 10);
      if (dayIso === todayIso) today.push(s);
      else if (dayIso > todayIso) upcoming.push(s);
      else past.push(s);
    }
    return { today, upcoming, past };
  }, [visible, todayIso]);

  function handleUnschedule(id: string) {
    setOptimisticRemoved((prev) => new Set(prev).add(id));
    startTransition(async () => {
      const res = await unscheduleOutfitAction({ scheduledOutfitId: id });
      if (!res.ok) {
        // Roll back the optimistic removal on failure.
        setOptimisticRemoved((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  }

  return (
    <div className="mt-6 flex flex-col gap-7">
      {groups.today.length > 0 && (
        <Section title={t("groups.today")}>
          {groups.today.map((s) => (
            <ScheduleCard
              key={s.id}
              schedule={s}
              pieces={pieceMap}
              timeLabel={tTime(s.timeOfDay)}
              onUnschedule={() => handleUnschedule(s.id)}
              ariaUnschedule={t("unschedule")}
            />
          ))}
        </Section>
      )}
      {groups.upcoming.length > 0 && (
        <Section title={t("groups.upcoming")}>
          {groups.upcoming.map((s) => (
            <ScheduleCard
              key={s.id}
              schedule={s}
              pieces={pieceMap}
              timeLabel={tTime(s.timeOfDay)}
              onUnschedule={() => handleUnschedule(s.id)}
              ariaUnschedule={t("unschedule")}
            />
          ))}
        </Section>
      )}
      {groups.past.length > 0 && (
        <Section title={t("groups.past")}>
          {groups.past.map((s) => (
            <ScheduleCard
              key={s.id}
              schedule={s}
              pieces={pieceMap}
              timeLabel={tTime(s.timeOfDay)}
              onUnschedule={() => handleUnschedule(s.id)}
              ariaUnschedule={t("unschedule")}
              dimmed
            />
          ))}
        </Section>
      )}

      {visible.length === 0 && (
        <div className="rounded-[18px] bg-paper p-6 text-center">
          <p className="text-[13.5px] text-ink/65">{t("empty")}</p>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="px-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
        {title}
      </p>
      <div className="mt-2.5 flex flex-col gap-2">{children}</div>
    </div>
  );
}

function ScheduleCard({
  schedule,
  pieces,
  timeLabel,
  onUnschedule,
  ariaUnschedule,
  dimmed,
}: {
  schedule: Schedule;
  pieces: Map<string, Piece>;
  timeLabel: string;
  onUnschedule: () => void;
  ariaUnschedule: string;
  dimmed?: boolean;
}) {
  const date = new Date(schedule.scheduledFor);
  const dayLabel = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const [removing, setRemoving] = useState(false);

  return (
    <div
      className={[
        "flex items-center gap-3 rounded-[18px] bg-paper p-3.5",
        dimmed ? "opacity-65" : "",
      ].join(" ")}
    >
      <div className="flex shrink-0 gap-[3px]">
        {schedule.pieces.slice(0, 3).map((p) => {
          const piece = pieces.get(p.pieceId);
          if (!piece) return null;
          return (
            <div
              key={p.pieceId}
              className="h-[44px] w-[30px] overflow-hidden rounded-[6px]"
              style={{ background: piece.swatchHex ?? "#C9CDD6" }}
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
        <p className="text-[13.5px] font-semibold tracking-[-0.01em] text-ink">
          {schedule.name ?? schedule.occasion ?? dayLabel}
        </p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink/55">
          {dayLabel} · {timeLabel}
          {schedule.occasion ? ` · ${schedule.occasion}` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          setRemoving(true);
          onUnschedule();
        }}
        disabled={removing}
        aria-label={ariaUnschedule}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink/[0.05] text-ink/55 hover:bg-ink/[0.10] hover:text-ink disabled:opacity-50"
      >
        {removing ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 size={14} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
