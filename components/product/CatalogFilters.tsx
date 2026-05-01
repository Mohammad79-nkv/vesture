"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";

const CATEGORIES = ["TOPS", "BOTTOMS", "DRESSES", "OUTERWEAR", "SHOES", "BAGS", "ACCESSORIES"] as const;
const GENDERS = ["WOMEN", "MEN", "UNISEX", "KIDS"] as const;

export function CatalogFilters() {
  const t = useTranslations("catalog");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value && value.length > 0) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="space-y-6 text-sm">
      <Group label={t("category")}>
        <RadioRow
          name="category"
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          current={params.get("category")}
          onChange={(v) => setParam("category", v)}
        />
      </Group>

      <Group label={t("gender")}>
        <RadioRow
          name="gender"
          options={GENDERS.map((g) => ({ value: g, label: g }))}
          current={params.get("gender")}
          onChange={(v) => setParam("gender", v)}
        />
      </Group>

      <Group label={t("currency")}>
        <input
          type="text"
          maxLength={3}
          defaultValue={params.get("currency") ?? ""}
          onBlur={(e) => setParam("currency", e.target.value.toUpperCase() || null)}
          placeholder="AED"
          className="w-full border border-ink/20 bg-paper px-2 py-1 text-sm uppercase"
        />
      </Group>

      <button
        type="button"
        onClick={() => router.push(pathname)}
        className="text-xs uppercase tracking-wider text-ink/60 underline"
      >
        {t("clearFilters")}
      </button>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wider text-ink/60">{label}</p>
      {children}
    </div>
  );
}

function RadioRow({
  name,
  options,
  current,
  onChange,
}: {
  name: string;
  options: { value: string; label: string }[];
  current: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2">
          <input
            type="radio"
            name={name}
            checked={current === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span className="text-sm">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}
