import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, Sparkles } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireOnboarded } from "@/lib/auth";
import { getOutfit } from "@/lib/services/outfit";
import { transformedUrl } from "@/lib/adapters/cloudinary";
import { StyleDetailActions } from "@/components/closet/StyleDetailActions";
import { MannequinCanvas } from "@/components/closet/MannequinCanvas";
import type { OutfitSlot } from "@/lib/services/outfit";
import type { ClosetPiece } from "@prisma/client";

// /closet/styles/[id] — outfit detail view. Phase 3A surfaces the saved
// composition, name, occasion, and wear-log row. Phase 3B will add the
// AI feedback panel (frame 06b) right where the "AI score · soon"
// callout currently sits.
export default async function StyleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const user = await requireOnboarded();
  const outfit = await getOutfit({ userId: user.id, outfitId: id });
  if (!outfit) notFound();

  const t = await getTranslations("closetStyles");
  const tBuilder = await getTranslations("closetBuilder");
  const tSlot = await getTranslations("outfit.slots");
  const tOcc = await getTranslations("outfit.occasions");

  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Convert outfit pieces into the shape MannequinCanvas expects.
  const pieces: Partial<Record<OutfitSlot, ClosetPiece>> = {};
  for (const p of outfit.pieces) {
    pieces[p.slot as OutfitSlot] = p.piece;
  }
  const slotLabels = Object.fromEntries(
    (
      ["TOP", "BOTTOM", "DRESS", "OUTER", "SHOES", "BAG", "ACCESSORY"] as OutfitSlot[]
    ).map((s) => [s, tSlot(s)]),
  ) as Record<OutfitSlot, string>;

  return (
    <main className="flex flex-1 flex-col bg-mist text-ink">
      <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col px-5 pt-2 pb-32 sm:max-w-[520px]">
        <Link
          href="/closet/styles"
          className="inline-flex items-center gap-1.5 self-start py-2 text-[12px] font-medium tracking-[-0.01em] text-ink/70 hover:text-ink"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          {t("back")}
        </Link>

        {/* Mannequin (read-only) */}
        <div className="mt-2 px-0">
          <MannequinCanvas
            pieces={pieces}
            slotLabels={slotLabels}
            selectedSlot={null}
            onTapEmpty={() => {}}
            onTapFilled={() => {}}
          />
        </div>

        {/* Title block */}
        <div className="mt-4 px-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
            {outfit.occasion ? tOcc(outfit.occasion) : tBuilder("subAutoSave")}
          </p>
          <h1 className="mt-1 text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">
            {outfit.name ?? t("untitled")}
          </h1>
          <p className="mt-1 font-mono text-[11px] text-ink/55">
            {outfit.lastWornAt
              ? t("wornCount", {
                  n: outfit.wearCount,
                  date: dateFmt.format(outfit.lastWornAt),
                })
              : t("wornNeverYet")}
          </p>
        </div>

        {/* Pieces list */}
        <ul className="mt-4 flex flex-col gap-1.5 rounded-2xl bg-paper p-1.5">
          {outfit.pieces.map((row) => (
            <li
              key={`${row.outfitId}-${row.slot}`}
              className="flex items-center gap-3 rounded-xl px-3 py-2"
            >
              <span
                aria-hidden="true"
                className="h-10 w-10 shrink-0 overflow-hidden rounded-lg"
                style={{ background: row.piece.swatchHex ?? "#C9CDD6" }}
              >
                {row.piece.publicId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={transformedUrl(row.piece.publicId, 120)}
                    alt={row.piece.name ?? row.piece.category}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-ink">
                  {row.piece.name ?? row.piece.category}
                </p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-ink/55">
                  {tSlot(row.slot as OutfitSlot)}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* AI score · coming soon (Phase 3B will replace this) */}
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-primary/10 p-3.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-paper">
            <Sparkles size={14} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold tracking-[-0.01em] text-primary">
              {t("scoreSoon")}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5">
          <StyleDetailActions outfitId={outfit.id} />
        </div>
      </div>
    </main>
  );
}
