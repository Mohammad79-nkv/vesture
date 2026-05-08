"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, Loader2, RefreshCcw, Sparkles } from "lucide-react";
import { createPieceAction } from "@/app/[locale]/(shop)/closet/actions";
import type { ClosetPieceInput } from "@/lib/domain/schemas";
import type { AnalyzedPiece } from "@/lib/services/piece-analyzer";

// Phase 3D · frame 08 ("AI · auto-tagging") implementation. A
// fullscreen sheet that takes a freshly-uploaded photo, sends it to
// /api/closet/analyze, and animates a "scanning" feed of detected
// attributes as the data populates. The user confirms with Continue
// → createPieceAction saves with the analyzed values and redirects
// to /closet/[id].
//
// State machine:
//   analyzing  → POST /api/closet/analyze in flight, scan line on
//   ready      → response arrived, rows reveal one-by-one
//   saving     → user hit Continue, createPieceAction running
//   error      → API call or save failed, fallback affordances shown
//
// We keep the row reveal at ≥1.5s even on a fast API response so the
// scan animation doesn't strobe past — perceived AI work is part of
// the affordance the user is paying for.

type Phase = "analyzing" | "ready" | "saving" | "error";

type DetectionRow = {
  key: keyof AnalyzedPiece | "name";
  label: string;
  value: string | null;
  swatch?: string | null;
  confidence?: number;
};

const MIN_ANALYZE_MS = 1500;
const ROW_STAGGER_MS = 380;
const ROW_LOAD_MS = 500;

export function AutoTagAnalyzer({
  open,
  photo,
  onRetake,
  onFallback,
}: {
  open: boolean;
  photo: { url: string; publicId: string };
  onRetake: () => void;
  onFallback: () => void;
}) {
  const t = useTranslations("closetAdd");
  const tFilters = useTranslations("closet.filters");

  const [phase, setPhase] = useState<Phase>("analyzing");
  const [piece, setPiece] = useState<AnalyzedPiece | null>(null);
  // The clean-product image gen runs alongside tag analysis on a
  // separate endpoint — it's slower (~10-15s vs ~3-5s for tags),
  // so we track its state independently. `imagePhase` drives the
  // "polishing image…" pill + the Continue gate (Continue stays
  // disabled while imagePhase === "loading" so the user can't
  // accidentally save before the generated image is ready).
  // "failed" still allows Continue with the original photo as a
  // graceful fallback.
  const [imagePhase, setImagePhase] = useState<
    "loading" | "ready" | "failed"
  >("loading");
  const [generatedImage, setGeneratedImage] = useState<{
    publicId: string;
    url: string;
  } | null>(null);
  const [errorCode, setErrorCode] = useState<
    "BUDGET_EXCEEDED" | "MODEL_FAILED" | "OFFLINE" | null
  >(null);
  const [revealedAt, setRevealedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [saving, startSave] = useTransition();
  // Cycling headline word — derived from a tick counter so the
  // effect only owns the interval, never a synchronous setState.
  const [headlineTick, setHeadlineTick] = useState(0);
  const cycleFields = useMemo(
    () => [
      t("analyze.fields.fabric"),
      t("analyze.fields.color"),
      t("analyze.fields.cut"),
      t("analyze.fields.formality"),
    ],
    [t],
  );
  const headlineField = cycleFields[headlineTick % cycleFields.length]!;

  // Lock body scroll while the analyzer is mounted so the page
  // behind doesn't scroll under the modal layer.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Kick off both API calls in parallel on first open. Tags use
  // /api/closet/analyze, image gen uses /api/closet/generate-image
  // — they progress independently so the UI can surface tags as
  // soon as they're ready while the slower image keeps a separate
  // "polishing image…" pill + gates Continue.
  //
  // State resets live inside the async IIFE (not in the effect
  // body) so the lint rule about synchronous setState in effects
  // is satisfied; React still batches the resets before paint.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setPhase("analyzing");
      setPiece(null);
      setGeneratedImage(null);
      setImagePhase("loading");
      setErrorCode(null);
      setRevealedAt(null);
      const startedAt = Date.now();

      // Tag analysis — must succeed for the user to continue.
      // We await this on the "happy" path of the IIFE so the
      // overall phase transitions on its result. The image gen
      // request fires in parallel below and updates its own
      // independent state when it completes.
      const tagsPromise = (async () => {
        try {
          const res = await fetch("/api/closet/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicId: photo.publicId }),
          });
          if (!res.ok) {
            const j = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            return {
              ok: false as const,
              error:
                j.error === "BUDGET_EXCEEDED"
                  ? ("BUDGET_EXCEEDED" as const)
                  : ("MODEL_FAILED" as const),
            };
          }
          const data = (await res.json()) as { piece: AnalyzedPiece };
          return { ok: true as const, piece: data.piece };
        } catch {
          return { ok: false as const, error: "OFFLINE" as const };
        }
      })();

      // Image gen — fire-and-update, never blocks the page from
      // becoming usable. On any failure imagePhase flips to
      // "failed" and Continue uses the original photo.
      void (async () => {
        try {
          const res = await fetch("/api/closet/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicId: photo.publicId }),
          });
          if (cancelled) return;
          if (!res.ok) {
            setImagePhase("failed");
            return;
          }
          const data = (await res.json()) as {
            generatedImage: { publicId: string; url: string };
          };
          if (cancelled) return;
          setGeneratedImage(data.generatedImage);
          setImagePhase("ready");
        } catch {
          if (cancelled) return;
          setImagePhase("failed");
        }
      })();

      const tagResult = await tagsPromise;
      if (cancelled) return;
      if (!tagResult.ok) {
        setErrorCode(tagResult.error);
        setPhase("error");
        return;
      }
      // Pad the visible analyze time so the scan feels intentional
      // even when the model returns in a few hundred ms.
      const waited = Date.now() - startedAt;
      const wait = Math.max(0, MIN_ANALYZE_MS - waited);
      setTimeout(() => {
        if (cancelled) return;
        setPiece(tagResult.piece);
        setPhase("ready");
        setRevealedAt(Date.now());
      }, wait);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, photo.publicId]);

  // Drive the cycling headline tick during analysis. setState only
  // happens inside the interval callback (not synchronously in the
  // effect body) so no cascading-render warning.
  useEffect(() => {
    if (phase !== "analyzing") return;
    const id = window.setInterval(
      () => setHeadlineTick((c) => c + 1),
      900,
    );
    return () => window.clearInterval(id);
  }, [phase]);

  // Drive the staggered row-reveal clock. Each row has its own
  // pending → loading → done transition based on `revealedAt`.
  useEffect(() => {
    if (phase !== "ready" || revealedAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 60);
    return () => window.clearInterval(id);
  }, [phase, revealedAt]);

  // Convert the analyzed payload into the row list the UI renders.
  // Empty/optional fields still render as "pending" rows so the
  // user can see what was attempted vs read off the photo.
  const rows: DetectionRow[] = useMemo(() => {
    if (!piece) {
      return [
        { key: "category", label: t("analyze.fieldLabels.category"), value: null },
        { key: "color", label: t("analyze.fieldLabels.color"), value: null },
        { key: "fabric", label: t("analyze.fieldLabels.fabric"), value: null },
        { key: "formality", label: t("analyze.fieldLabels.formality"), value: null },
        { key: "season", label: t("analyze.fieldLabels.season"), value: null },
      ];
    }
    return [
      {
        key: "category",
        label: t("analyze.fieldLabels.category"),
        value: tFilters(piece.category),
        confidence: piece.categoryConfidence,
      },
      {
        key: "color",
        label: t("analyze.fieldLabels.color"),
        value: piece.color ?? null,
        swatch: piece.swatchHex,
        confidence: piece.colorConfidence,
      },
      {
        key: "fabric",
        label: t("analyze.fieldLabels.fabric"),
        value: piece.fabric ?? null,
        confidence: piece.fabricConfidence,
      },
      {
        key: "formality",
        label: t("analyze.fieldLabels.formality"),
        value: piece.formality ? t(`formality_${piece.formality}`) : null,
        confidence: piece.formalityConfidence,
      },
      {
        key: "season",
        label: t("analyze.fieldLabels.season"),
        value: piece.season ? t(`season_${piece.season}`) : null,
        confidence: piece.seasonConfidence,
      },
    ];
  }, [piece, t, tFilters]);

  function rowState(idx: number): "pending" | "loading" | "done" {
    if (revealedAt === null) return "pending";
    const elapsed = now - revealedAt;
    const startAt = idx * ROW_STAGGER_MS;
    if (elapsed < startAt) return "pending";
    if (elapsed < startAt + ROW_LOAD_MS) return "loading";
    return "done";
  }

  function handleContinue() {
    if (!piece) return;
    setPhase("saving");
    // Prefer the AI-generated clean-product image when one came
    // back; otherwise fall back to the user's original photo. The
    // ClosetPiece row only stores ONE image — we pick the cleaner
    // one when the model gave us a usable result.
    const finalImage = generatedImage ?? {
      publicId: photo.publicId,
      url: photo.url,
    };
    const input: ClosetPieceInput = {
      imageUrl: finalImage.url,
      publicId: finalImage.publicId,
      name: piece.name,
      category: piece.category,
      color: piece.color,
      swatchHex: piece.swatchHex,
      fabric: piece.fabric,
      formality: piece.formality,
      season: piece.season,
      brand: piece.brand,
    };
    startSave(async () => {
      try {
        await createPieceAction(input);
      } catch (err) {
        // Server actions throw NEXT_REDIRECT on success — let it propagate.
        if (err && typeof err === "object" && "digest" in err) throw err;
        setErrorCode("MODEL_FAILED");
        setPhase("error");
      }
    });
  }

  const headlineHero =
    phase === "ready" && piece?.name
      ? piece.name
      : phase === "ready"
        ? tFilters(piece?.category ?? "TOPS")
        : null;

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("analyze.dialogLabel")}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-mist text-ink"
    >
      {/* Eyebrow + headline */}
      <div className="px-5 pt-12 pb-3">
        <div className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
          <span
            aria-hidden="true"
            className={[
              "inline-block h-1.5 w-1.5 rounded-full",
              phase === "analyzing"
                ? "animate-pulse bg-primary"
                : phase === "error"
                  ? "bg-red-500"
                  : "bg-primary",
            ].join(" ")}
          />
          {phase === "error"
            ? t("analyze.statusError")
            : phase === "ready" || phase === "saving"
              ? t("analyze.statusReady")
              : t("analyze.statusAnalysing")}
        </div>
        <h1 className="mt-1.5 text-[26px] font-bold leading-[1.05] tracking-[-0.02em] text-ink">
          {headlineHero ??
            t.rich("analyze.headlineRich", {
              field: headlineField,
              accent: (chunks) => (
                <span className="font-light text-primary">{chunks}</span>
              ),
            })}
        </h1>
      </div>

      {/* Photo preview — swaps from the user's noisy original to
         the AI-generated clean-product version once that's
         available, so the user sees what they're about to save.
         The original stays visible during the scan animation
         (analyzing phase) since the generated one isn't ready
         yet, and it's also the fallback if image gen failed. */}
      <div className="px-3.5">
        <div className="relative h-[320px] overflow-hidden rounded-3xl bg-paper shadow-[inset_0_0_0_1px_rgba(33,39,57,0.06)]">
          {/* Original photo — fades out when the generated image
             is ready so the cross-fade reads as a transformation. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt=""
            className={[
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
              generatedImage ? "opacity-0" : "opacity-100",
            ].join(" ")}
            loading="eager"
          />
          {/* Generated clean-product image — overlays the original
             on top, fades in when the API call returns it. Uses
             contain to preserve the white-background aesthetic
             without cropping the piece. */}
          {generatedImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={generatedImage.url}
              alt=""
              className="absolute inset-0 h-full w-full bg-paper object-contain transition-opacity duration-300"
              loading="eager"
            />
          ) : null}
          {/* Detection box overlay — only while analyzing/ready,
             AND only on the original photo (the generated clean-
             product image is the result, no need to re-frame). */}
          {phase !== "error" && !generatedImage && (
            <div className="pointer-events-none absolute inset-x-12 inset-y-8 rounded-xl border-[1.5px] border-dashed border-primary/70 bg-gradient-to-b from-primary/5 to-primary/0">
              {(piece || phase === "analyzing") && (
                <span className="absolute -top-2.5 start-2 rounded-md bg-primary px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-paper">
                  {piece
                    ? `${tFilters(piece.category)}${
                        piece.categoryConfidence !== undefined
                          ? ` · ${Math.round(piece.categoryConfidence)}%`
                          : ""
                      }`
                    : t("analyze.scanning")}
                </span>
              )}
            </div>
          )}
          {/* Scan line — only while analyzing */}
          {phase === "analyzing" && (
            <div
              aria-hidden="true"
              className="ai-scan-line pointer-events-none absolute inset-x-0 top-0 h-[60px] bg-gradient-to-b from-primary/0 via-primary/25 to-primary/0"
            />
          )}
        </div>
      </div>

      {/* Detection feed */}
      <div className="flex-1 px-5 pt-5">
        <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
          {t("analyze.detected")}
        </p>
        {phase === "error" ? (
          <div className="rounded-2xl bg-paper p-4 text-[13px] text-ink/70">
            {errorCode === "BUDGET_EXCEEDED"
              ? t("analyze.errors.budget")
              : errorCode === "OFFLINE"
                ? t("analyze.errors.offline")
                : t("analyze.errors.failed")}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row, idx) => {
              const state = rowState(idx);
              return (
                <DetectRow
                  key={row.key}
                  row={row}
                  state={state}
                  pendingLabel={t("analyze.pendingValue")}
                />
              );
            })}
          </ul>
        )}
      </div>

      {/* Bottom actions */}
      <div
        className="px-3.5 pt-5"
        style={{
          paddingBottom: "max(20px, env(safe-area-inset-bottom, 0px))",
        }}
      >
        {phase === "error" ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onFallback}
              className="inline-flex h-[50px] flex-1 items-center justify-center rounded-2xl bg-ink/[0.06] text-[12px] font-medium uppercase tracking-[0.06em] text-ink/85"
            >
              {t("analyze.fillManually")}
            </button>
            <button
              type="button"
              onClick={onRetake}
              className="inline-flex h-[50px] flex-1 items-center justify-center gap-1.5 rounded-2xl bg-ink text-[12px] font-medium uppercase tracking-[0.06em] text-paper"
            >
              <RefreshCcw size={13} aria-hidden="true" />
              {t("analyze.retake")}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRetake}
              disabled={phase === "saving"}
              className="inline-flex h-[50px] flex-1 items-center justify-center rounded-2xl bg-ink/[0.06] text-[12px] font-medium uppercase tracking-[0.06em] text-ink/85 disabled:opacity-60"
            >
              {t("analyze.retake")}
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={
                phase !== "ready" || saving || imagePhase === "loading"
              }
              className="inline-flex h-[50px] flex-[2] items-center justify-center gap-2 rounded-2xl bg-ink text-[12px] font-medium uppercase tracking-[0.06em] text-paper disabled:opacity-60"
            >
              {saving || phase === "saving" ? (
                <>
                  <Loader2
                    size={14}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  {t("analyze.saving")}
                </>
              ) : phase === "ready" && imagePhase === "loading" ? (
                <>
                  <Loader2
                    size={14}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  {t("analyze.polishing")}
                </>
              ) : phase === "ready" ? (
                <>
                  {t("analyze.continue")}
                  <ArrowRight size={14} aria-hidden="true" />
                </>
              ) : (
                <>
                  <Sparkles size={14} aria-hidden="true" />
                  {t("analyze.analyzing")}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DetectRow({
  row,
  state,
  pendingLabel,
}: {
  row: DetectionRow;
  state: "pending" | "loading" | "done";
  pendingLabel: string;
}) {
  // Treat a missing analyzed value as a soft-pending row even after
  // reveal — the model couldn't read this attribute, so we render it
  // dimmed instead of pretending it's confirmed.
  const isMissing = state === "done" && !row.value;
  const opacity = state === "pending" ? "opacity-45" : isMissing ? "opacity-55" : "opacity-100";
  const conf = state === "done" && row.confidence !== undefined
    ? Math.round(row.confidence)
    : null;
  const swatchOk = row.swatch && /^#[0-9a-fA-F]{6}$/.test(row.swatch);

  return (
    <li
      className={[
        "flex items-center gap-3 rounded-2xl bg-paper px-3.5 py-3 transition-opacity",
        opacity,
      ].join(" ")}
    >
      <span className="w-[70px] shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-ink/55">
        {row.label}
      </span>
      <span className="flex flex-1 items-center gap-2 text-[13.5px] font-medium text-ink">
        {swatchOk && (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(33,39,57,0.15)]"
            style={{ background: row.swatch! }}
          />
        )}
        <span className="truncate">
          {state === "pending" || (state === "loading" && !row.value)
            ? pendingLabel
            : (row.value ?? pendingLabel)}
        </span>
      </span>
      {state === "loading" && (
        <span aria-hidden="true" className="inline-flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
        </span>
      )}
      {state === "done" && row.value && (
        <span className="inline-flex items-center gap-1.5">
          {conf !== null && (
            <span className="font-mono text-[10px] text-secondary">{conf}%</span>
          )}
          <span className="grid h-4 w-4 place-items-center rounded-full bg-secondary text-paper">
            <Check size={9} strokeWidth={3} aria-hidden="true" />
          </span>
        </span>
      )}
    </li>
  );
}
