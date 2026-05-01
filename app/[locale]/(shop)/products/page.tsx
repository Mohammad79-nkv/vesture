import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { listPublishedProducts } from "@/lib/services/product";
import { ProductCard } from "@/components/product/ProductCard";
import { CatalogFilters } from "@/components/product/CatalogFilters";

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("catalog");
  const result = await listPublishedProducts({
    category: typeof sp.category === "string" ? sp.category : undefined,
    gender: typeof sp.gender === "string" ? sp.gender : undefined,
    minPrice: typeof sp.minPrice === "string" ? sp.minPrice : undefined,
    maxPrice: typeof sp.maxPrice === "string" ? sp.maxPrice : undefined,
    currency: typeof sp.currency === "string" ? sp.currency : undefined,
    page: typeof sp.page === "string" ? sp.page : undefined,
  });

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-light">{t("title")}</h1>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside>
          <CatalogFilters />
        </aside>

        <section>
          {result.items.length === 0 ? (
            <p className="py-16 text-center text-ink/60">{t("empty")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
              {result.items.map((p) => (
                <ProductCard key={p.id} product={p} locale={locale} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
