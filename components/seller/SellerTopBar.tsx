import { getTranslations } from "next-intl/server";
import { auth } from "@clerk/nextjs/server";
import { Link } from "@/lib/i18n/navigation";
import { prisma } from "@/lib/adapters/prisma";
import { SellerAvatar } from "@/components/ui/SellerAvatar";
import { SellerNavTabs } from "./SellerNavTabs";
import { pickLocalized } from "@/lib/domain/i18n";
import type { Locale } from "@/lib/i18n/config";

// Sticky white top bar shown on every /dashboard route. Mirrors the
// design's seller-mode chrome: VESTURE wordmark + "Seller" chip, nav,
// bot status pill (currently inert / coming-soon), search button, and
// the seller's avatar + handle.
export async function SellerTopBar({ locale }: { locale: Locale }) {
  const t = await getTranslations("seller.topBar");
  const tBrand = await getTranslations("brand");

  const { userId: clerkId } = await auth();
  const seller = clerkId
    ? await prisma.sellerProfile.findFirst({
        where: { user: { clerkId } },
        select: {
          slug: true,
          storeNameEn: true,
          storeNameAr: true,
          status: true,
        },
      })
    : null;

  const storeName = seller
    ? pickLocalized({ en: seller.storeNameEn, ar: seller.storeNameAr }, locale)
    : "—";

  return (
    <header className="sticky top-0 z-30 border-b border-ink/8 bg-paper">
      <div className="mx-auto flex h-16 max-w-[1376px] items-center gap-7 px-8">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="text-[15px] font-extrabold tracking-[0.32em] text-ink">
            {tBrand("name").toUpperCase()}
          </span>
          <span className="rounded-sm bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-primary">
            {t("sellerChip")}
          </span>
        </Link>

        <SellerNavTabs />

        <div className="ms-auto flex items-center gap-3">
          {/* Bot status pill — coming soon, so we mark it inactive */}
          <span className="hidden items-center gap-1.5 rounded-full bg-mist px-2.5 py-1.5 font-mono text-[11px] text-ink/65 md:inline-flex">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-muted" />
            {t("botInactive")}
          </span>

          <button
            type="button"
            aria-label="Search"
            disabled
            className="grid h-9 w-9 place-items-center rounded-full bg-mist text-ink/70"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {seller && (
            <div className="flex items-center gap-2.5 border-s border-ink/8 ps-3">
              <SellerAvatar slug={seller.slug} name={seller.storeNameEn} size={32} />
              <div className="hidden md:block">
                <p className="text-[12px] font-semibold leading-tight text-ink">{storeName}</p>
                <p className="font-mono text-[10px] text-muted">@{seller.slug}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
