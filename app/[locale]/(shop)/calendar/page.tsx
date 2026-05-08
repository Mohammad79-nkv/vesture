import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireOnboarded } from "@/lib/auth";
import { listScheduledRange } from "@/lib/services/scheduled-outfit";
import { prisma } from "@/lib/adapters/prisma";
import { CalendarList } from "@/components/calendar/CalendarList";

// Phase 3E.7 · /calendar route.
//
// Read-only listing of upcoming + recent past scheduled outfits.
// Server component — fetches the schedules in a ±14 day window
// around today, hydrates piece data so the client can render
// thumbs without a second round-trip, then hands off to
// CalendarList for the visual grouping (Today / Upcoming /
// Recent).

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const user = await requireOnboarded();
  const t = await getTranslations("calendar");

  const schedules = await listScheduledRange({
    userId: user.id,
    rangeDays: 14,
  });

  // Hydrate the unique pieceIds across all schedules in one query.
  // Cheap because schedules max out around (14 days × 3 slots × 6
  // pieces) ≈ 250 ids; in practice users have a few schedules so
  // the IN clause stays small.
  const allPieceIds = new Set<string>();
  for (const s of schedules) {
    const arr = s.pieces as Array<{ slot: string; pieceId: string }>;
    for (const p of arr) allPieceIds.add(p.pieceId);
  }
  const pieces =
    allPieceIds.size === 0
      ? []
      : await prisma.closetPiece.findMany({
          where: { userId: user.id, id: { in: [...allPieceIds] } },
          select: {
            id: true,
            name: true,
            category: true,
            color: true,
            swatchHex: true,
            publicId: true,
            imageUrl: true,
          },
        });

  return (
    <main className="flex flex-1 flex-col bg-mist pb-32 text-ink">
      <div className="mx-auto w-full max-w-[480px] px-5 pt-2 sm:max-w-[560px]">
        <Link
          href="/today"
          aria-label={t("back")}
          className="-ms-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-ink/70 hover:bg-ink/[0.04] hover:text-ink"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </Link>

        <div className="mt-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
            {t("kicker")}
          </p>
          <h1 className="mt-2 text-[34px] font-bold leading-[0.96] tracking-[-0.03em] text-ink sm:text-[38px]">
            {t.rich("title", {
              accent: (chunks) => (
                <span className="font-light italic text-primary">
                  {chunks}
                </span>
              ),
            })}
          </h1>
        </div>

        <CalendarList
          schedules={schedules.map((s) => ({
            id: s.id,
            scheduledFor: s.scheduledFor.toISOString(),
            timeOfDay: s.timeOfDay,
            name: s.name,
            occasion: s.occasion,
            pieces: s.pieces as Array<{ slot: string; pieceId: string }>,
          }))}
          pieces={pieces}
        />
      </div>
    </main>
  );
}
