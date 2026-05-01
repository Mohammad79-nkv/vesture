import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@clerk/nextjs/server";
import { isLocale } from "@/lib/i18n/config";
import { getSellerBySlug } from "@/lib/services/seller";
import { ProductTile } from "@/components/product/ProductTile";
import { pickLocalized } from "@/lib/domain/i18n";
import { prisma } from "@/lib/adapters/prisma";

export default async function SellerPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const seller = await getSellerBySlug(slug);
  if (!seller) notFound();

  const storeName = pickLocalized(
    { en: seller.storeNameEn, ar: seller.storeNameAr },
    locale,
  );
  const bio = seller.bioEn
    ? pickLocalized({ en: seller.bioEn, ar: seller.bioAr }, locale)
    : null;

  // Re-shape products to include seller fields the tile expects.
  const products = seller.products.map((p) => ({
    ...p,
    seller: {
      slug: seller.slug,
      storeNameEn: seller.storeNameEn,
      storeNameAr: seller.storeNameAr,
    },
  }));

  // Same favorite-set fetch the catalog uses, scoped to this seller's products.
  const { userId: clerkId } = await auth();
  let favoritedIds = new Set<string>();
  if (clerkId && products.length > 0) {
    const me = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (me) {
      const favs = await prisma.favorite.findMany({
        where: { userId: me.id, productId: { in: products.map((p) => p.id) } },
        select: { productId: true },
      });
      favoritedIds = new Set(favs.map((f) => f.productId));
    }
  }
  const authenticated = Boolean(clerkId);

  return (
    <main className="flex flex-1 flex-col bg-mist">
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
        <header className="mb-10 border-b border-ink/10 pb-8">
          <p className="mb-2 text-xs uppercase tracking-[0.3em] text-ink/60">
            {seller.countryCode}
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight">{storeName}</h1>
          {bio && <p className="mt-3 max-w-2xl text-ink/70">{bio}</p>}
        </header>

        {products.length === 0 ? (
          <p className="py-16 text-center text-ink/60">No products yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductTile
                key={p.id}
                product={p}
                locale={locale}
                isFavorited={favoritedIds.has(p.id)}
                authenticated={authenticated}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
