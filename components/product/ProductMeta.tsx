import { getTranslations } from "next-intl/server";

// Optional structured attributes. None of these live on the schema yet — the
// labels render even without values so the layout matches the design intent
// and the seller can fill them in once we add the columns.
export async function ProductMeta({
  data,
}: {
  data?: Partial<{
    material: string;
    lining: string;
    care: string;
    origin: string;
    ships: string;
    returns: string;
  }>;
}) {
  const t = await getTranslations("product");
  const cells: { key: keyof NonNullable<typeof data>; label: string }[] = [
    { key: "material", label: t("material") },
    { key: "lining", label: t("lining") },
    { key: "care", label: t("care") },
    { key: "origin", label: t("origin") },
    { key: "ships", label: t("ships") },
    { key: "returns", label: t("returns") },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {cells.map((c) => (
        <div
          key={c.key}
          className="rounded-xl bg-paper px-4 py-5 shadow-[0_1px_2px_rgba(33,39,57,0.04)]"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/45">
            {c.label}
          </p>
          {data?.[c.key] && (
            <p className="mt-1 text-sm text-ink">{data[c.key]}</p>
          )}
        </div>
      ))}
    </div>
  );
}
