import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Plus, Sparkles } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireOnboarded } from "@/lib/auth";
import { listMyOutfits } from "@/lib/services/outfit";
import { transformedUrl } from "@/lib/adapters/cloudinary";
import { StyleCard, type StyleCardPiece } from "@/components/closet/StyleCard";

// /closet/styles — saved-looks grid (frame 06c minus AI score badges,
// which arrive in Phase 3B). Empty state nudges to /closet/builder.
export default async function ClosetStylesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const user = await requireOnboarded();
  const outfits = await listMyOutfits({ userId: user.id });

  const t = await getTranslations("closetStyles");
  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  });

  return (
    <main className="flex flex-1 flex-col bg-mist text-ink">
      <div className="mx-auto w-full max-w-[460px] px-4 pt-8 pb-32 sm:max-w-[520px]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-1">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
              {t("subtitle", { count: outfits.length })}
            </p>
            <h1 className="mt-1 text-[30px] font-bold leading-none tracking-[-0.02em] text-ink">
              {t.rich("title", {
                accent: (chunks) => (
                  <span className="font-light text-primary">{chunks}</span>
                ),
              })}
            </h1>
          </div>
          <Link
            href="/closet/builder"
            aria-label={t("newCta")}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-paper hover:bg-ink/90"
          >
            <Plus size={14} aria-hidden="true" />
            {t("newCta")}
          </Link>
        </div>

        {outfits.length === 0 ? (
          <div className="mt-10 rounded-3xl bg-paper p-8 text-center shadow-[inset_0_0_0_1px_rgba(33,39,57,0.06)]">
            <span
              aria-hidden="true"
              className="grid h-12 w-12 mx-auto place-items-center rounded-full bg-primary/10 text-primary"
            >
              <Sparkles size={20} aria-hidden="true" />
            </span>
            <p className="mt-4 text-[14px] leading-[1.5] text-ink/65">
              {t("empty")}
            </p>
            <Link
              href="/closet/builder"
              className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink px-6 text-[12px] font-medium uppercase tracking-[0.06em] text-paper hover:bg-ink/90"
            >
              <Plus size={14} aria-hidden="true" />
              {t("emptyCta")}
            </Link>
          </div>
        ) : (
          <ul className="mt-5 grid grid-cols-2 gap-2.5">
            {outfits.map((outfit) => {
              const cards: StyleCardPiece[] = outfit.pieces.map((p) => ({
                id: p.piece.id,
                swatchHex: p.piece.swatchHex,
                publicId: p.piece.publicId ?? null,
                imageUrl: p.piece.publicId
                  ? transformedUrl(p.piece.publicId, 200)
                  : p.piece.imageUrl,
                category: p.piece.category,
                name: p.piece.name,
              }));
              const worn =
                outfit.wearCount > 0 && outfit.lastWornAt
                  ? {
                      wearCount: outfit.wearCount,
                      lastWornFormatted: dateFmt.format(outfit.lastWornAt),
                    }
                  : { wearCount: 0 as const };
              return (
                <li key={outfit.id}>
                  <StyleCard
                    outfitId={outfit.id}
                    name={outfit.name}
                    pieces={cards}
                    worn={worn}
                    untitledLabel={t("untitled")}
                    neverWornLabel={t("wornNeverYet")}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
