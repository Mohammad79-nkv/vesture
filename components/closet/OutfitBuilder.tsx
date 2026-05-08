"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Bookmark, Loader2, Sparkles } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { cloudinaryUrl } from "@/lib/domain/cloudinary-url";
import {
  OUTFIT_SLOTS,
  defaultSlotForCategory,
  type OutfitSlot,
} from "@/lib/domain/outfit-slots";
import { MannequinCanvas } from "./MannequinCanvas";
import {
  createOutfitAction,
  saveAndScoreAction,
  updateOutfitAction,
} from "@/app/[locale]/(shop)/closet/builder/actions";
import type { ClosetPiece } from "@prisma/client";

// Outfit builder client component. Phase 3A scope:
//   - Slot-based tap-to-fill (no @dnd-kit, no positioning)
//   - DRESS conflicts with TOP+BOTTOM: client mirrors the service-layer
//     rule for instant feedback, server enforces canonically on save
//   - Disabled "Score: —/100 · coming soon" pill where the live score
//     will land in Phase 3B
//   - Save / Update via server actions in actions.ts
//   - Editing path: parent passes initialPieces + outfitId; we PATCH
//     instead of POST

const OCCASIONS = [
  "CASUAL",
  "WORK",
  "FORMAL",
  "EVENING",
  "WEDDING",
  "VACATION",
  "SPORT",
] as const;

type SlotMap = Partial<Record<OutfitSlot, ClosetPiece>>;

function applyConflictsClient(map: SlotMap, slot: OutfitSlot, piece: ClosetPiece): SlotMap {
  const next = { ...map };
  if (slot === "DRESS") {
    delete next.TOP;
    delete next.BOTTOM;
  } else if (slot === "TOP" || slot === "BOTTOM") {
    delete next.DRESS;
  }
  next[slot] = piece;
  return next;
}

export function OutfitBuilder({
  closetPieces,
  initialOutfitId,
  initialName,
  initialOccasion,
  initialPieces,
}: {
  closetPieces: ClosetPiece[];
  initialOutfitId?: string;
  initialName?: string | null;
  initialOccasion?: string | null;
  initialPieces?: SlotMap;
}) {
  const t = useTranslations("closetBuilder");
  const tScore = useTranslations("closetScore");
  const tSlot = useTranslations("outfit.slots");
  const tOcc = useTranslations("outfit.occasions");
  const tFilters = useTranslations("closet.filters");
  const locale = useLocale();

  const [pieces, setPieces] = useState<SlotMap>(initialPieces ?? {});
  const [name, setName] = useState(initialName ?? "");
  const [occasion, setOccasion] = useState(initialOccasion ?? "");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The rail re-filters by category. "all" shows everything.
  const railPieces = useMemo(() => {
    if (activeFilter === "all") return closetPieces;
    return closetPieces.filter((p) => p.category === activeFilter);
  }, [closetPieces, activeFilter]);

  const railFilters = useMemo(
    () => [
      "all",
      "TOPS",
      "BOTTOMS",
      "DRESSES",
      "OUTERWEAR",
      "SHOES",
      "BAGS",
      "ACCESSORIES",
    ],
    [],
  );

  const slotLabels = useMemo(
    () =>
      Object.fromEntries(
        OUTFIT_SLOTS.map((s) => [s, tSlot(s)]),
      ) as Record<OutfitSlot, string>,
    [tSlot],
  );

  const placedCount = Object.keys(pieces).length;
  const isEditing = Boolean(initialOutfitId);

  function handlePieceFromRail(piece: ClosetPiece) {
    const slot = defaultSlotForCategory(piece.category);
    if (!slot) return;
    setPieces((prev) => applyConflictsClient(prev, slot, piece));
    setError(null);
  }

  function handleTapFilled(slot: OutfitSlot) {
    setPieces((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  }

  function handleTapEmpty(slot: OutfitSlot) {
    // Phase 3A: empty-slot tap focuses the rail filter on that slot's
    // category. Phase 3C will swap this for the bottom-sheet flow.
    const cat = (Object.entries(SLOT_TO_CATEGORY).find(
      ([s]) => s === slot,
    )?.[1] ?? "all") as string;
    setActiveFilter(cat);
  }

  // Build the payload once — both save flows want the same shape.
  function buildPayload() {
    return {
      name: name.trim() || undefined,
      occasion: occasion || undefined,
      pieces: Object.entries(pieces).map(([slot, piece]) => ({
        slot: slot as OutfitSlot,
        pieceId: piece!.id,
      })),
    };
  }

  function validate(): boolean {
    setError(null);
    if (placedCount === 0) {
      setError(t("errors.needPieces"));
      return false;
    }
    return true;
  }

  // Bookmark icon → save without scoring.
  function handleSave() {
    if (!validate()) return;
    const payload = buildPayload();
    startTransition(async () => {
      try {
        if (isEditing && initialOutfitId) {
          await updateOutfitAction(initialOutfitId, payload);
        } else {
          await createOutfitAction(payload);
        }
      } catch (err) {
        // Server actions throw NEXT_REDIRECT on success — let it propagate.
        if (err && typeof err === "object" && "digest" in err) throw err;
        setError(t("errors.saveFailed"));
      }
    });
  }

  // Magenta gradient CTA → save AND score in one round-trip; budget gate
  // and the LLM call run server-side, then we redirect to the detail
  // page where the score is already persisted.
  function handleSaveAndScore() {
    if (!validate()) return;
    const payload = buildPayload();
    startTransition(async () => {
      try {
        await saveAndScoreAction({ ...payload, locale });
      } catch (err) {
        if (err && typeof err === "object" && "digest" in err) throw err;
        const msg = err instanceof Error ? err.message : "";
        if (msg === "budgetExceeded") {
          setError(tScore("errors.budgetExceeded"));
        } else if (msg === "needPieces") {
          setError(t("errors.needPieces"));
        } else {
          setError(t("errors.saveFailed"));
        }
      }
    });
  }

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip bg-mist text-ink">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
            {isEditing ? t("subEditing") : t("subAutoSave")}
          </p>
          <h1 className="mt-0.5 text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink">
            {t("title")}
          </h1>
        </div>
        <Link
          href="/closet/styles"
          className="rounded-full border border-ink/15 bg-paper px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink hover:border-ink/40"
        >
          {t("myStyles")}
        </Link>
      </header>

      {/* Body — pb leaves room for the fixed-bottom dock + iOS home indicator */}
      <div className="pb-[140px] px-4 ">
        {/* Canvas */}
        <div className="pt-1">
          <div className="relative">
            <MannequinCanvas
              pieces={pieces}
              slotLabels={slotLabels}
              selectedSlot={null}
              onTapEmpty={handleTapEmpty}
              onTapFilled={handleTapFilled}
            />
            {/* Top-left piece-count chip */}
            <div className="absolute start-2.5 top-2.5 rounded-md bg-ink px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-paper">
              {placedCount} {placedCount === 1 ? "piece" : "pieces"}
            </div>
            {/* Top-right disabled live score */}
            <div
              aria-disabled="true"
              title={t("scoreSoon")}
              className="absolute end-2.5 top-2.5 inline-flex cursor-not-allowed items-center gap-1.5 rounded-full bg-paper/95 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-ink/45 shadow-[0_1px_2px_rgba(33,39,57,0.06)]"
            >
              <Sparkles size={10} aria-hidden="true" />
              {t("scorePill")}
            </div>
          </div>
        </div>

        {/* Look meta */}
        <div className="mt-3 flex items-center gap-2 px-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            maxLength={80}
            // min-w-0 lets the input shrink below the placeholder text's
            // intrinsic width — without it, flex items default to
            // min-width: auto and the long "Name this look (e.g. Wine bar
            // · Nov 14)" placeholder forces the whole row past viewport.
            className="h-10 min-w-0 flex-1 rounded-xl bg-paper px-3 text-[13.5px] text-ink shadow-[inset_0_0_0_1px_rgba(33,39,57,0.08)] outline-none focus:shadow-[inset_0_0_0_1.5px_rgba(205,2,104,0.6)]"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 px-4">
          {OCCASIONS.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOccasion(occasion === o ? "" : o)}
              className={[
                "rounded-full border px-3 py-1.5 text-[11.5px] font-medium tracking-[-0.01em] transition-colors",
                occasion === o
                  ? "border-ink bg-ink text-paper"
                  : "border-ink/15 bg-paper text-ink/65 hover:border-ink/40",
              ].join(" ")}
            >
              {tOcc(o)}
            </button>
          ))}
        </div>

        {/* Rail filters + scrolling rail. Wrapping each row in
           `overflow-x-clip` neutralises the `-mx-4 px-4` bleed locally —
           without this, the bleed contributes to the page's scrollWidth
           and Safari versions that don't fully respect body-level
           overflow-x-clip end up with a horizontal page scroll. */}
        <div className="overflow-x-clip">
          <div className="scrollbar-hide -mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4">
            {railFilters.map((f) => {
              const label = f === "all" ? t("rail.all") : tFilters(f);
              const isActive = activeFilter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActiveFilter(f)}
                  className={[
                    "whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium tracking-[-0.01em] transition-colors",
                    isActive
                      ? "border-ink bg-ink text-paper"
                      : "border-ink/15 bg-paper text-ink/70 hover:border-ink/40",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {railPieces.length === 0 ? (
          <div className="mt-4 px-4 text-center">
            <p className="text-[13px] text-ink/55">{t("rail.empty")}</p>
            <Link
              href="/closet/add"
              className="mt-3 inline-flex items-center gap-1 rounded-full bg-ink px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-paper"
            >
              {t("rail.addFirst")}
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-clip">
            <div className="scrollbar-hide -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1">
              {railPieces.map((p) => {
              const isPlaced = Object.values(pieces).some(
                (placed) => placed?.id === p.id,
              );
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePieceFromRail(p)}
                  className="flex shrink-0 flex-col items-start"
                  style={{ width: 78 }}
                >
                  <div
                    className={[
                      "relative h-[94px] w-full overflow-hidden rounded-xl",
                      isPlaced ? "ring-2 ring-primary" : "",
                    ].join(" ")}
                    style={{ background: p.swatchHex ?? "#C9CDD6" }}
                  >
                    {p.publicId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cloudinaryUrl(p.publicId, 200)}
                        alt={p.name ?? p.category}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <span className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.06em] text-ink/55">
                    {tFilters(p.category)}
                  </span>
                </button>
              );
            })}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 px-4 text-[13px] text-red-600">{error}</p>
        )}
      </div>

      {/* Floating dock — fixed at the bottom of the viewport, stays put
         regardless of scroll position. Mirrors frame 06's pairing: small
         bookmark icon save (left) + magenta gradient "Get AI feedback"
         (right) with the piece count suffix. */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 px-4 py-3"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-mist via-mist/85 to-mist/0" />
        <div className="mx-auto flex w-full max-w-[640px] items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            aria-label={t("save")}
            className="inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-paper text-ink shadow-[inset_0_0_0_1px_rgba(33,39,57,0.08),0_4px_16px_rgba(33,39,57,0.06)] transition-colors hover:bg-mist disabled:opacity-60"
          >
            {pending ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Bookmark size={18} strokeWidth={2} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={handleSaveAndScore}
            disabled={pending}
            className="relative inline-flex h-[52px] flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl text-[13.5px] font-bold tracking-[-0.01em] text-paper shadow-[0_8px_28px_rgba(205,2,104,0.35)] transition-transform active:scale-[0.99] disabled:opacity-70"
            style={{
              background: "linear-gradient(180deg, #CD0268 0%, #A50253 100%)",
            }}
          >
            {pending ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                {tScore("scoring")}
              </>
            ) : (
              <>
                <Sparkles size={16} aria-hidden="true" />
                <span>{tScore("getCta")}</span>
                <span aria-hidden="true" className="font-mono text-[11px] tracking-[0.06em] text-paper/55">
                  · {placedCount} {placedCount === 1 ? "piece" : "pieces"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const SLOT_TO_CATEGORY: Record<OutfitSlot, string> = {
  TOP: "TOPS",
  BOTTOM: "BOTTOMS",
  DRESS: "DRESSES",
  OUTER: "OUTERWEAR",
  SHOES: "SHOES",
  BAG: "BAGS",
  ACCESSORY: "ACCESSORIES",
};
