import { Calendar } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import type { TimeOfDay } from "@prisma/client";

// Phase 3E.7 · "On your calendar" pill on /today.
//
// Renders when the user has at least one ScheduledOutfit for
// today. Tapping routes to /calendar where the full list lives.
// Compact one-liner: "ON YOUR CALENDAR · TONIGHT" with the
// outfit name + occasion underneath.

export function ScheduledPill({
  scheduled,
}: {
  scheduled: Array<{
    id: string;
    timeOfDay: TimeOfDay;
    name: string | null;
    occasion: string | null;
  }>;
}) {
  const t = useTranslations("today.scheduledPill");
  const tTime = useTranslations("today.schedule.time");
  if (scheduled.length === 0) return null;
  // Show the first scheduled entry inline, with a +N pill if there
  // are multiple — tap routes to the full /calendar list anyway.
  const head = scheduled[0]!;
  const extras = scheduled.length - 1;

  return (
    <div className="px-4 pt-3">
      <Link
        href="/calendar"
        className="flex items-center gap-2.5 rounded-[14px] bg-secondary/10 px-3 py-2.5 text-secondary"
      >
        <Calendar size={14} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-secondary/80">
            {t("kicker", { time: tTime(head.timeOfDay) })}
          </p>
          <p className="mt-0.5 truncate text-[12px] font-medium tracking-[-0.01em]">
            {head.name ?? head.occasion ?? t("untitled")}
            {extras > 0 ? ` · +${extras}` : ""}
          </p>
        </div>
      </Link>
    </div>
  );
}
