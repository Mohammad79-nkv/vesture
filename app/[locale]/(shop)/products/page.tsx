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
    <main className="flex flex-1 flex-col overflow-x-hidden bg-mist pb-safe-mobile-nav">
      <div className="mx-auto grid w-full max-w-[1400px] gap-10 px-5 py-6 sm:px-6 lg:grid-cols-[1fr_360px] lg:py-10">
        <section>
          <header className="mb-6 flex flex-col lg:mb-8">
            <div className="order-1 flex flex-wrap items-end justify-between gap-4 lg:order-2">
              <h1 className="text-[44px] font-bold leading-[0.95] tracking-[-0.02em] text-ink md:text-6xl md:font-extrabold">
                {t("headlineLead")}
                <br className="md:hidden" />{" "}
                <span className="font-light text-primary">{t("headlineAccent")}</span>.
              </h1>
              <div className="hidden items-center gap-3 md:flex">
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
            <p className="order-2 mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted lg:order-1 lg:mb-4 lg:mt-0">
              {t("edition", { n: EDITION_NUMBER })}
            </p>
          </header>

          <div className="mb-5 lg:hidden">
            <MobileStylistBar sellerCount={totalApproved} />
          </div>

          <div className="mb-6">
            <CatalogChips />
          </div>

          {result.items.length === 0 ? (
            <p className="py-16 text-center text-ink/60">{t("empty")}</p>
          ) : (
            <>
              {/* Mobile masonry — 2 grid columns with server-balanced contents.
                  Grid (instead of flex) guarantees the columns split available
                  width exactly in half regardless of intrinsic image dimensions.
                  min-w-0 keeps each column from growing past its grid track. */}
              <div className="grid grid-cols-2 gap-2.5 lg:hidden">
                {[colA, colB].map((col, ci) => (
                  <div key={ci} className="flex min-w-0 flex-col gap-2.5">
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

              {/* Desktop grid — uniform aspect, caption-below tiles. */}
              <div className="hidden lg:grid lg:grid-cols-3 lg:gap-x-4 lg:gap-y-10 xl:grid-cols-4">
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
            </>
          )}
        </section>

        <StylistSidebar />
      </div>
    </main>
  );
}
