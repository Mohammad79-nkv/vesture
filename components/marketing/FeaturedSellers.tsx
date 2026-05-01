import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { SellerAvatar } from "@/components/ui/SellerAvatar";
import { listFeaturedSellers } from "@/lib/services/seller";
import type { Locale } from "@/lib/i18n/config";

// Brand-aligned color palette used for the featured-seller card swatches.
// Picked deterministically from the slug so the same seller always renders
// with the same primary color across the site (matches SellerAvatar's intent).
const SWATCH_PALETTE = ["#cd0268", "#34889e", "#212739", "#e89bb8", "#5fa2b3"];

function pickSwatch(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return SWATCH_PALETTE[h % SWATCH_PALETTE.length] ?? SWATCH_PALETTE[0]!;
}

const COUNTRY_CITY: Record<string, string> = {
  AE: "Dubai",
  SA: "Riyadh",
  EG: "Cairo",
  IR: "Tehran",
  TR: "Istanbul",
  JO: "Amman",
  LB: "Beirut",
  KW: "Kuwait City",
  QA: "Doha",
  BH: "Manama",
  OM: "Muscat",
};

export async function FeaturedSellers({ locale }: { locale: Locale }) {
  const t = await getTranslations("featuredSellers");
  const { items: sellers, totalApproved } = await listFeaturedSellers(6);

  if (sellers.length === 0) return null;

  return (
    <section className="bg-mist py-20">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
              {t("eyebrow")}
            </p>
            <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">
              {t("headlineLead")}{" "}
              <span className="font-display italic text-secondary">
                {t("headlineAccent")}
              </span>
              .
            </h2>
          </div>
          <Link
            href="/products"
            className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink hover:text-primary"
          >
            {t("browseAll", { n: totalApproved.toLocaleString() })} →
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sellers.map((s) => {
            const cityLabel =
              COUNTRY_CITY[s.countryCode] ?? s.countryCode;
            return (
              <SellerSwatchCard
                key={s.id}
                slug={s.slug}
                storeName={s.storeNameEn}
                cityLabel={cityLabel}
                followLabel={t("follow")}
                primary={pickSwatch(s.slug)}
              />
            );
          })}
        </div>

        <span className="sr-only">{locale}</span>
      </div>
    </section>
  );
}

function SellerSwatchCard({
  slug,
  storeName,
  cityLabel,
  followLabel,
  primary,
}: {
  slug: string;
  storeName: string;
  cityLabel: string;
  followLabel: string;
  primary: string;
}) {
  // Decorative diagonal-stripe overlay reused from the marketing chat preview.
  const stripes =
    "repeating-linear-gradient(-45deg, transparent 0 6px, rgba(255,255,255,0.08) 6px 7px)";
  return (
    <article className="overflow-hidden rounded-2xl bg-paper">
      <Link
        href={`/sellers/${slug}`}
        aria-label={storeName}
        className="grid grid-cols-3 gap-px"
      >
        <div
          className="aspect-[4/5]"
          style={{ background: primary, backgroundImage: stripes }}
        />
        <div
          className="aspect-[4/5]"
          style={{ background: "#cdd1d8", backgroundImage: stripes }}
        />
        <div
          className="aspect-[4/5]"
          style={{ background: "#212739", backgroundImage: stripes }}
        />
      </Link>

      <div className="flex items-center gap-3 p-4">
        <SellerAvatar slug={slug} name={storeName} size={28} />
        <Link
          href={`/sellers/${slug}`}
          className="flex flex-1 items-center gap-2 text-sm hover:underline"
        >
          <span className="font-medium">@{slug}</span>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#34889e"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-label="Verified"
            className="shrink-0"
          >
            <circle cx="12" cy="12" r="10" fill="#34889e" stroke="none" />
            <polyline points="8 12 11 15 16 9" stroke="white" />
          </svg>
          <span className="text-ink/55">·</span>
          <span className="text-ink/65">{cityLabel}</span>
        </Link>
        <Link
          href={`/sellers/${slug}`}
          className="rounded-full border border-ink/20 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-ink hover:border-ink"
        >
          {followLabel}
        </Link>
      </div>
    </article>
  );
}
