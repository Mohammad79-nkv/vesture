"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUploader, type UploadedImage } from "./ImageUploader";

const CATEGORIES = ["TOPS", "BOTTOMS", "DRESSES", "OUTERWEAR", "SHOES", "BAGS", "ACCESSORIES"] as const;
const GENDERS = ["WOMEN", "MEN", "UNISEX", "KIDS"] as const;
const SEASONS = ["SPRING", "SUMMER", "FALL", "WINTER", "ALL_SEASON"] as const;
const OCCASIONS = ["CASUAL", "WORK", "FORMAL", "EVENING", "WEDDING", "VACATION", "SPORT"] as const;
const STYLES = ["MINIMAL", "STREETWEAR", "CLASSIC", "BOHO", "LUXURY", "VINTAGE", "EDGY"] as const;

export type ProductFormInitial = {
  id?: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  priceMinor: number;
  currency: string;
  category: string;
  gender: string;
  season?: string;
  occasion?: string;
  style?: string;
  sizes: string[];
  colors: string[];
  images: UploadedImage[];
};

export function ProductForm({
  initial,
  defaultCurrency,
  onSubmit,
  locale,
}: {
  initial?: ProductFormInitial;
  defaultCurrency: string;
  locale: string;
  onSubmit: (
    payload: ProductFormInitial,
    intent: "draft" | "publish",
  ) => Promise<{ ok: true; slug: string } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [images, setImages] = useState<UploadedImage[]>(initial?.images ?? []);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handle(intent: "draft" | "publish", form: FormData) {
    setError(null);
    setSubmitting(true);
    try {
      const sizes = String(form.get("sizes") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const colors = String(form.get("colors") ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const priceMajor = Number(form.get("price") ?? 0);
      const currency = String(form.get("currency") ?? defaultCurrency).toUpperCase();
      // For 2-decimal currencies; the server reformats per ISO if needed.
      const priceMinor = Math.round(priceMajor * 100);

      const payload: ProductFormInitial = {
        id: initial?.id,
        titleEn: String(form.get("titleEn") ?? "").trim(),
        titleAr: String(form.get("titleAr") ?? "").trim(),
        descriptionEn: String(form.get("descriptionEn") ?? "").trim(),
        descriptionAr: String(form.get("descriptionAr") ?? "").trim(),
        priceMinor,
        currency,
        category: String(form.get("category") ?? "TOPS"),
        gender: String(form.get("gender") ?? "WOMEN"),
        season: (form.get("season") as string) || undefined,
        occasion: (form.get("occasion") as string) || undefined,
        style: (form.get("style") as string) || undefined,
        sizes,
        colors,
        images,
      };

      const res = await onSubmit(payload, intent);
      if (!res.ok) {
        setError(res.error);
      } else {
        router.push(`/${locale}/dashboard/products`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const intent = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("data-intent");
        handle((intent as "draft" | "publish") ?? "draft", new FormData(e.currentTarget));
      }}
      className="space-y-6"
    >
      <Section title="Title & description">
        <Field name="titleEn" label="Title (English)" required defaultValue={initial?.titleEn} />
        <Field name="titleAr" label="Title (Arabic)" defaultValue={initial?.titleAr} />
        <Area name="descriptionEn" label="Description (English)" required defaultValue={initial?.descriptionEn} />
        <Area name="descriptionAr" label="Description (Arabic)" defaultValue={initial?.descriptionAr} />
      </Section>

      <Section title="Price">
        <div className="grid grid-cols-2 gap-3">
          <Field
            name="price"
            label="Price"
            required
            type="number"
            step={0.01}
            defaultValue={initial ? (initial.priceMinor / 100).toString() : ""}
          />
          <Field
            name="currency"
            label="Currency"
            required
            maxLength={3}
            uppercase
            defaultValue={initial?.currency ?? defaultCurrency}
          />
        </div>
      </Section>

      <Section title="Taxonomy">
        <div className="grid grid-cols-2 gap-3">
          <Select name="category" label="Category" options={CATEGORIES} required defaultValue={initial?.category} />
          <Select name="gender" label="Gender" options={GENDERS} required defaultValue={initial?.gender} />
          <Select name="season" label="Season" options={SEASONS} defaultValue={initial?.season} />
          <Select name="occasion" label="Occasion" options={OCCASIONS} defaultValue={initial?.occasion} />
          <Select name="style" label="Style" options={STYLES} defaultValue={initial?.style} />
        </div>
      </Section>

      <Section title="Variants">
        <Field
          name="sizes"
          label="Sizes (comma-separated)"
          placeholder="S, M, L"
          defaultValue={initial?.sizes.join(", ")}
        />
        <Field
          name="colors"
          label="Colors (comma-separated)"
          placeholder="black, white, beige"
          defaultValue={initial?.colors.join(", ")}
        />
      </Section>

      <Section title="Images">
        <ImageUploader value={images} onChange={setImages} />
      </Section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          data-intent="draft"
          disabled={submitting}
          className="border border-ink px-6 py-2 text-sm uppercase tracking-wider"
        >
          Save draft
        </button>
        <button
          data-intent="publish"
          disabled={submitting || images.length === 0}
          className="bg-ink px-6 py-2 text-sm uppercase tracking-wider text-paper disabled:opacity-50"
        >
          Publish
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-t border-ink/10 pt-6">
      <legend className="text-xs uppercase tracking-wider text-ink/60">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({
  name,
  label,
  required,
  defaultValue,
  type = "text",
  placeholder,
  maxLength,
  uppercase,
  step,
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  uppercase?: boolean;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-ink/60">
        {label}{required && " *"}
      </span>
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        defaultValue={defaultValue}
        className={`w-full border border-ink/20 bg-paper px-3 py-2 text-sm focus:border-ink focus:outline-none ${
          uppercase ? "uppercase" : ""
        }`}
      />
    </label>
  );
}

function Area({
  name,
  label,
  required,
  defaultValue,
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-ink/60">
        {label}{required && " *"}
      </span>
      <textarea
        name={name}
        required={required}
        defaultValue={defaultValue}
        rows={4}
        className="w-full border border-ink/20 bg-paper px-3 py-2 text-sm focus:border-ink focus:outline-none"
      />
    </label>
  );
}

function Select({
  name,
  label,
  options,
  required,
  defaultValue,
}: {
  name: string;
  label: string;
  options: readonly string[];
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-ink/60">
        {label}{required && " *"}
      </span>
      <select
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        className="w-full border border-ink/20 bg-paper px-3 py-2 text-sm focus:border-ink focus:outline-none"
      >
        {!required && <option value="">—</option>}
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
