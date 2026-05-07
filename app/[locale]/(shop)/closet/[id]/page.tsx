import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, Sparkles } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireOnboarded } from "@/lib/auth";
import { getPiece } from "@/lib/services/closet";
import { transformedUrl } from "@/lib/adapters/cloudinary";
import { PieceDetailActions } from "@/components/closet/PieceDetailActions";

// Frame cl-piece-detail (mobile closet design). Photo hero + metadata rows
// + wear log + status switch + delete. AI suggestions are deferred to
// Phase 3 — surfaced here as a coming-soon callout instead.
export default async function PiecePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const user = await requireOnboarded();
  const piece = await getPiece({ userId: user.id, pieceId: id });
  if (!piece) notFound();

  const t = await getTranslations("closetPiece");
  const tFilters = await getTranslations("closet.filters");
  const tAdd = await getTranslations("closetAdd");

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const lastWornText = piece.lastWornAt
    ? t("wornCount", {
        n: piece.wearCount,
        date: dateFormatter.format(piece.lastWornAt),
      })
    : t("neverWorn");

  return (
    <main className="flex flex-1 flex-col bg-mist text-ink">
      <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col px-5 pt-2 pb-32 sm:max-w-[520px]">
        <Link
          href="/closet"
          className="inline-flex items-center gap-1.5 self-start rounded-full bg-paper/0 py-2 text-[12px] font-medium tracking-[-0.01em] text-ink/70 hover:text-ink"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          {t("back")}
        </Link>

        {/* Photo */}
        <div
          className="relative mt-2 overflow-hidden rounded-3xl shadow-[inset_0_0_0_1px_rgba(33,39,57,0.06)]"
          style={{ background: piece.swatchHex ?? "#C9CDD6" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={transformedUrl(piece.publicId, 720)}
            alt={piece.name ?? tFilters(piece.category)}
            className="aspect-[3/4] w-full object-cover"
            loading="eager"
          />
        </div>

        {/* Title block */}
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
            {tFilters(piece.category)}
            {piece.brand ? ` · ${piece.brand}` : ""}
          </p>
          <h1 className="mt-1 text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">
            {piece.name ?? tFilters(piece.category)}
          </h1>
          <p className="mt-1 font-mono text-[11px] text-ink/55">
            {lastWornText}
          </p>
        </div>

        {/* Meta rows */}
        <ul className="mt-4 flex flex-col gap-1.5 rounded-2xl bg-paper p-1.5">
          <Row label={tAdd("color")} value={piece.color} swatch={piece.swatchHex} />
          <Row label={tAdd("fabric")} value={piece.fabric} />
          <Row
            label={tAdd("formality")}
            value={piece.formality ? tAdd(`formality_${piece.formality}`) : null}
          />
          <Row
            label={tAdd("season")}
            value={piece.season ? tAdd(`season_${piece.season}`) : null}
          />
          {piece.notes && <Row label={tAdd("notes")} value={piece.notes} multiline />}
        </ul>

        {/* "Style this piece" — opens /stylist with a brief prefilled in
           the input. The model will be encouraged via system prompt to
           call search_my_closet first, so the suggestion mixes owned + new
           the way the welcome hero promised. */}
        <Link
          href={{
            pathname: "/stylist",
            query: {
              prompt: t("aiSuggestPrompt", {
                name: piece.name ?? tFilters(piece.category).toLowerCase(),
              }),
            },
          }}
          className="mt-4 flex items-start gap-3 rounded-2xl bg-primary/10 p-3.5 transition-colors hover:bg-primary/15"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-paper">
            <Sparkles size={14} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold tracking-[-0.01em] text-primary">
              {t("aiSuggestTitle")}
            </p>
            <p className="mt-0.5 text-[11.5px] leading-[1.4] text-ink/65">
              {t("aiSuggestBody")}
            </p>
            <p className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-primary">
              {t("aiSuggestCta")} →
            </p>
          </div>
        </Link>

        {/* Interactive actions (wear log, status, delete) */}
        <div className="mt-5">
          <PieceDetailActions pieceId={piece.id} status={piece.status} />
        </div>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  swatch,
  multiline,
}: {
  label: string;
  value: string | null;
  swatch?: string | null;
  multiline?: boolean;
}) {
  if (!value) return null;
  return (
    <li
      className={[
        "flex items-start gap-3 rounded-xl px-3",
        multiline ? "py-2.5" : "py-2 items-center",
      ].join(" ")}
    >
      <span className="w-[80px] shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-ink/55">
        {label}
      </span>
      <span className="flex-1 inline-flex items-center gap-2 text-[13.5px] font-medium text-ink">
        {swatch && /^#[0-9a-fA-F]{6}$/.test(swatch) && (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(33,39,57,0.15)]"
            style={{ background: swatch }}
          />
        )}
        <span className={multiline ? "whitespace-pre-wrap" : ""}>{value}</span>
      </span>
    </li>
  );
}
