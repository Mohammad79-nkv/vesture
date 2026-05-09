"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Camera, Loader2, RefreshCcw, Sparkles } from "lucide-react";
import { createPieceAction } from "@/app/[locale]/(shop)/closet/actions";
import { AutoTagAnalyzer } from "@/components/closet/AutoTagAnalyzer";
import { compressImage } from "@/lib/domain/compress-image";
import type { ClosetPieceInput } from "@/lib/domain/schemas";

const CATEGORIES = [
  "TOPS",
  "BOTTOMS",
  "DRESSES",
  "OUTERWEAR",
  "SHOES",
  "BAGS",
  "ACCESSORIES",
] as const;

const FORMALITIES = ["CASUAL", "SMART_CASUAL", "FORMAL"] as const;
const SEASONS = ["SPRING", "SUMMER", "FALL", "WINTER", "ALL_SEASON"] as const;

const FIELD_INPUT_CLS =
  "h-11 w-full rounded-xl bg-paper px-3 text-[14px] text-ink shadow-[inset_0_0_0_1px_rgba(33,39,57,0.08)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1.5px_rgba(205,2,104,0.6)]";
const FIELD_TEXTAREA_CLS =
  "w-full resize-none rounded-xl bg-paper px-3 py-2.5 text-[14px] leading-[1.45] text-ink shadow-[inset_0_0_0_1px_rgba(33,39,57,0.08)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1.5px_rgba(205,2,104,0.6)]";

type SignatureResponse = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
};

async function uploadToCloudinary(file: File, sig: SignatureResponse) {
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
    { method: "POST", body: form },
  );
  if (!res.ok) throw new Error(`Cloudinary upload failed: ${res.status}`);
  const data = (await res.json()) as { secure_url: string; public_id: string };
  return { url: data.secure_url, publicId: data.public_id };
}

// Two-step capture: photo first (file picker with capture="environment"
// opens the OS camera on mobile), then a manual tag form. Phase 3's vision
// tagger will pre-fill these fields; for now the user types them.
export function AddPieceForm() {
  const t = useTranslations("closetAdd");
  const tFilters = useTranslations("closet.filters");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [photo, setPhoto] = useState<{ url: string; publicId: string } | null>(null);
  // Phase 3D: when the photo is present the AI callout becomes a CTA
  // that opens the AutoTagAnalyzer overlay (frame 08).
  const [analyzerOpen, setAnalyzerOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [color, setColor] = useState("");
  const [swatchHex, setSwatchHex] = useState("");
  const [fabric, setFabric] = useState("");
  const [formality, setFormality] = useState<string>("");
  const [season, setSeason] = useState<string>("");
  const [brand, setBrand] = useState("");
  const [notes, setNotes] = useState("");

  async function handleFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      // Compress before upload — phone photos are routinely 4-12 MB
      // and we don't need that resolution for closet thumbnails or
      // downstream AI calls. compressImage falls back to the
      // original file on HEIC / decode failure so this never blocks
      // the upload.
      const compressed = await compressImage(file);
      const sigRes = await fetch("/api/upload?kind=closet", { method: "POST" });
      if (!sigRes.ok) throw new Error("Could not get upload signature");
      const sig = (await sigRes.json()) as SignatureResponse;
      const result = await uploadToCloudinary(compressed, sig);
      setPhoto({ url: result.url, publicId: result.publicId });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setPhoto(null);
    setName("");
    setCategory("");
    setColor("");
    setSwatchHex("");
    setFabric("");
    setFormality("");
    setSeason("");
    setBrand("");
    setNotes("");
    setSubmitError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!photo) {
      setSubmitError(t("errors.imageRequired"));
      return;
    }
    if (!category) {
      setSubmitError(t("errors.categoryRequired"));
      return;
    }
    setSubmitError(null);
    const input: ClosetPieceInput = {
      imageUrl: photo.url,
      publicId: photo.publicId,
      name: name || undefined,
      category: category as ClosetPieceInput["category"],
      color: color || undefined,
      swatchHex: swatchHex || undefined,
      fabric: fabric || undefined,
      formality: (formality || undefined) as ClosetPieceInput["formality"],
      season: (season || undefined) as ClosetPieceInput["season"],
      brand: brand || undefined,
      notes: notes || undefined,
    };
    startTransition(async () => {
      try {
        await createPieceAction(input);
      } catch (err) {
        // Server actions throw NEXT_REDIRECT on success — let it propagate.
        if (err && typeof err === "object" && "digest" in err) throw err;
        setSubmitError(t("errors.saveFailed"));
      }
    });
  }

  // ── Step 1: photo capture / upload ─────────────────────────────────────
  if (!photo) {
    return (
      <div className="flex flex-1 flex-col px-5 pb-32 pt-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
          {t("step1")}
        </p>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-0.02em] text-ink">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-[320px] text-[13.5px] leading-[1.5] text-ink-soft">
          {t("subtitle")}
        </p>

        <label
          className={[
            "mt-6 flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-ink/25 bg-paper text-center transition-colors",
            uploading ? "opacity-70" : "hover:border-ink/50",
          ].join(" ")}
        >
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            disabled={uploading}
            onChange={(e) => handleFile(e.target.files)}
          />
          {uploading ? (
            <>
              <Loader2 size={28} className="animate-spin text-primary" aria-hidden="true" />
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink/55">
                {t("uploading")}
              </p>
            </>
          ) : (
            <>
              <span className="grid h-14 w-14 place-items-center rounded-full bg-ink text-paper">
                <Camera size={22} aria-hidden="true" />
              </span>
              <p className="px-6 text-[13.5px] font-medium text-ink">
                {t("uploadPrompt")}
              </p>
            </>
          )}
        </label>

        {uploadError && (
          <p className="mt-3 text-sm text-red-600">{uploadError}</p>
        )}
      </div>
    );
  }

  // ── Step 2/3: tagging form ─────────────────────────────────────────────
  return (
    <>
    <AutoTagAnalyzer
      open={analyzerOpen}
      photo={photo}
      onRetake={() => {
        setAnalyzerOpen(false);
        reset();
      }}
      onFallback={() => setAnalyzerOpen(false)}
    />
    <form onSubmit={submit} className="flex flex-1 flex-col px-5 pb-32 pt-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
        {t("step2")}
      </p>
      <h1 className="mt-1 text-[28px] font-bold tracking-[-0.02em] text-ink">
        {t("title")}
      </h1>

      {/* Photo preview + retake */}
      <div className="relative mt-5 overflow-hidden rounded-3xl bg-paper shadow-[inset_0_0_0_1px_rgba(33,39,57,0.06)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt=""
          className="aspect-[3/4] w-full object-cover"
          loading="lazy"
        />
        <button
          type="button"
          onClick={reset}
          className="absolute end-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-paper backdrop-blur"
        >
          <RefreshCcw size={11} aria-hidden="true" />
          {t("retake")}
        </button>
      </div>

      {/* AI auto-tag CTA — replaces the Phase 2 "coming soon" callout
         now that vision tagging actually ships. Tap opens the
         AutoTagAnalyzer overlay (frame 08). */}
      <button
        type="button"
        onClick={() => setAnalyzerOpen(true)}
        className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-primary/10 p-3.5 text-start transition-colors hover:bg-primary/15"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-paper">
          <Sparkles size={14} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold tracking-[-0.01em] text-primary">
            {t("aiAutoTagTitle")}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-[1.4] text-ink/65">
            {t("aiAutoTagBody")}
          </p>
        </div>
        <ArrowRight size={14} className="shrink-0 text-primary" aria-hidden="true" />
      </button>

      {/* Form fields */}
      <div className="mt-5 flex flex-col gap-4">
        <Field label={t("name")}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            maxLength={80}
            className={FIELD_INPUT_CLS}
          />
        </Field>

        <Field label={t("category")} required>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                active={category === c}
                onClick={() => setCategory(c)}
                label={tFilters(c)}
              />
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-[1fr_140px] gap-3">
          <Field label={t("color")}>
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder={t("colorPlaceholder")}
              maxLength={24}
              className={FIELD_INPUT_CLS}
            />
          </Field>
          <Field label={t("swatch")}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={swatchHex}
                onChange={(e) => setSwatchHex(e.target.value)}
                placeholder={t("swatchPlaceholder")}
                maxLength={7}
                className={`${FIELD_INPUT_CLS} font-mono`}
              />
              {/^#[0-9a-fA-F]{6}$/.test(swatchHex) && (
                <span
                  aria-hidden="true"
                  className="h-9 w-9 shrink-0 rounded-lg shadow-[inset_0_0_0_1px_rgba(33,39,57,0.15)]"
                  style={{ background: swatchHex }}
                />
              )}
            </div>
          </Field>
        </div>

        <Field label={t("fabric")}>
          <input
            type="text"
            value={fabric}
            onChange={(e) => setFabric(e.target.value)}
            placeholder={t("fabricPlaceholder")}
            maxLength={40}
            className={FIELD_INPUT_CLS}
          />
        </Field>

        <Field label={t("formality")}>
          <div className="flex flex-wrap gap-1.5">
            {FORMALITIES.map((f) => (
              <Chip
                key={f}
                active={formality === f}
                onClick={() => setFormality(formality === f ? "" : f)}
                label={t(`formality_${f}`)}
              />
            ))}
          </div>
        </Field>

        <Field label={t("season")}>
          <div className="flex flex-wrap gap-1.5">
            {SEASONS.map((s) => (
              <Chip
                key={s}
                active={season === s}
                onClick={() => setSeason(season === s ? "" : s)}
                label={t(`season_${s}`)}
              />
            ))}
          </div>
        </Field>

        <Field label={t("brand")}>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder={t("brandPlaceholder")}
            maxLength={40}
            className={FIELD_INPUT_CLS}
          />
        </Field>

        <Field label={t("notes")}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("notesPlaceholder")}
            maxLength={280}
            rows={3}
            className={FIELD_TEXTAREA_CLS}
          />
        </Field>
      </div>

      {submitError && (
        <p className="mt-4 text-sm text-red-600">{submitError}</p>
      )}

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-ink/5 text-[12px] font-medium uppercase tracking-[0.06em] text-ink/85"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 flex-[2] items-center justify-center gap-2 rounded-2xl bg-ink text-[12px] font-medium uppercase tracking-[0.06em] text-paper disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              {t("saving")}
            </>
          ) : (
            t("save")
          )}
        </button>
      </div>
    </form>
    </>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
        {label}
        {required && <span className="ms-1 text-primary">*</span>}
      </span>
      {children}
    </label>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1.5 text-[12px] font-medium tracking-[-0.01em] transition-colors",
        active
          ? "border-ink bg-ink text-paper"
          : "border-ink/15 bg-paper text-ink/70 hover:border-ink/40 hover:text-ink",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
