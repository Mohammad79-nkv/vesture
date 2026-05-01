import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth";
import { listFavorites } from "@/lib/services/favorite";
import { ProductCard } from "@/components/product/ProductCard";

export default async function FavoritesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const user = await requireUser();
  const favorites = await listFavorites(user.id);

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-light">Favorites</h1>
      {favorites.length === 0 ? (
        <p className="py-16 text-center text-ink/60">
          You haven&apos;t saved anything yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {favorites.map((f) => (
            <ProductCard key={f.id} product={f.product} locale={locale} />
          ))}
        </div>
      )}
    </main>
  );
}
