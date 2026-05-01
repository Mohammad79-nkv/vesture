import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isLocale } from "@/lib/i18n/config";
import { listPublishedProducts } from "@/lib/services/product";
import { listFeaturedSellers } from "@/lib/services/seller";
import { prisma } from "@/lib/adapters/prisma";
import { ProductTile } from "@/components/product/ProductTile";
import { PinCard } from "@/components/product/PinCard";
import { CatalogChips } from "@/components/product/CatalogChips";
import { RefineDrawer } from "@/components/product/RefineDrawer";
import { StylistSidebar } from "@/components/marketing/StylistSidebar";
import { MobileStylistBar } from "@/components/marketing/MobileStylistBar";
import { aspectFor, distributeMasonry } from "@/lib/domain/masonry";

// Fixed for now — could come from a CMS or weekly cron later.
const EDITION_NUMBER = 14;

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

  // Approved seller count powers the mobile stylist bar copy ("· N sellers").
  const { totalApproved } = await listFeaturedSellers(0);

  // Pull the user's favorited product IDs in one query so each tile can render
  // its initial bookmark state without N round-trips.
  const { userId: clerkId } = await auth();
  let favoritedIds = new Set<string>();
  if (clerkId) {
    const me = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (me) {
      const favs = await prisma.favorite.findMany({
        where: { userId: me.id },
        select: { productId: true },
      });
      favoritedIds = new Set(favs.map((f) => f.productId));
    }
  }
  const authenticated = Boolean(clerkId);

  // Pre-compute aspects + masonry distribution server-side so the mobile feed
  // renders without layout shift.
  const withAspects = result.items.map((p) => ({ p, aspect: aspectFor(p.slug) }));
  const [colA, colB] = distributeMasonry(withAspects, (item) => item.aspect.weight);

  return (
    <main className="flex flex-1 flex-col bg-mist pb-safe-mobile-nav">
      {/* ─── Mobile path: per-section padding, matches buyer-screens.jsx exactly ─── */}
      <div className="lg:hidden">
        <header className="px-5 pt-1 pb-3.5">
          <h1 className="text-[44px] font-bold leading-[0.95] tracking-[-0.02em] text-ink">
            {t("headlineLead")}
            <br />
            <span className="font-light text-primary">{t("headlineAccent")}</span>.
          </h1>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
            {t("edition", { n: EDITION_NUMBER })}
          </p>
        </header>

        <div className="px-3.5 pb-3.5">
          <MobileStylistBar sellerCount={totalApproved} />
        </div>

        <div className="px-3.5 pb-3.5">
          <CatalogChips />
        </div>

        {result.items.length === 0 ? (
          <p className="py-16 text-center text-ink/60">{t("empty")}</p>
        ) : (
          <div className="flex gap-2.5 px-3.5">
            {[colA, colB].map((col, ci) => (
              <div key={ci} className="flex min-w-0 flex-1 flex-col gap-2.5">
                {col.map(({ p, aspect }) => (
                  <PinCard
                    key={p.id}
                    product={p}
                    locale={locale}
                    isFavorited={favoritedIds.has(p.id)}
                    authenticated={authenticated}
                    aspectClass={aspect.ratio}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Desktop path: editorial header + chips + uniform grid + sidebar ─── */}
      <div className="mx-auto hidden w-full max-w-[1400px] gap-10 px-6 py-10 lg:grid lg:grid-cols-[1fr_360px]">
        <section>
          <header className="mb-8 flex flex-col">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
              {t("edition", { n: EDITION_NUMBER })}
            </p>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h1 className="text-6xl font-extrabold leading-[0.95] tracking-[-0.02em] text-ink">
                {t("headlineLead")}{" "}
                <span className="font-light text-primary">{t("headlineAccent")}</span>.
              </h1>
              <div className="flex items-center gap-3">
                <RefineDrawer />
                <span className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper">
                  {t("sort")}
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </div>
            </div>
          </header>

          <div className="mb-6">
            <CatalogChips />
          </div>

          {result.items.length === 0 ? (
            <p className="py-16 text-center text-ink/60">{t("empty")}</p>
          ) : (
            <div className="grid grid-cols-3 gap-x-4 gap-y-10 xl:grid-cols-4">
              {result.items.map((p) => (
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
        </section>

        <StylistSidebar />
      </div>
    </main>
  );
}
