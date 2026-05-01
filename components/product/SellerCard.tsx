import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { SellerAvatar } from "@/components/ui/SellerAvatar";
import { pickLocalized } from "@/lib/domain/i18n";
import type { Locale } from "@/lib/i18n/config";

// Country code → city display. We only store country on SellerProfile, so
// "based in" surfaces a country until we add a city field.
const COUNTRY_LABEL: Record<string, string> = {
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  EG: "Egypt",
  IR: "Iran",
  TR: "Turkey",
  JO: "Jordan",
  LB: "Lebanon",
  KW: "Kuwait",
  QA: "Qatar",
  BH: "Bahrain",
  OM: "Oman",
};

export async function SellerCard({
  seller,
  locale,
  children,
}: {
  seller: {
    slug: string;
    storeNameEn: string;
    storeNameAr: string | null;
    countryCode: string;
  };
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = await getTranslations("product");
  const storeName = pickLocalized(
    { en: seller.storeNameEn, ar: seller.storeNameAr },
    locale,
  );
  const based = COUNTRY_LABEL[seller.countryCode] ?? seller.countryCode;

  return (
    <aside className="rounded-2xl bg-paper p-6 shadow-[0_2px_30px_rgba(33,39,57,0.06)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/55">
        {t("madeBy")}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <SellerAvatar slug={seller.slug} name={seller.storeNameEn} size={44} />
        <Link
          href={`/sellers/${seller.slug}`}
          className="text-base font-semibold text-ink hover:underline"
        >
          @{seller.slug}
        </Link>
        <span className="ms-auto inline-grid h-5 w-5 place-items-center rounded-full bg-secondary text-paper">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-label="Verified"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat value="—" label={t("followers")} />
        <Stat value={based} label={t("basedIn")} truncate />
        <Stat value="—" label={t("rating")} />
      </div>

      <div className="my-6 h-px bg-ink/10" />

      {children}

      <span className="sr-only">{storeName}</span>
    </aside>
  );
}

function Stat({
  value,
  label,
  truncate,
}: {
  value: string;
  label: string;
  truncate?: boolean;
}) {
  return (
    <div className="rounded-lg bg-mist p-3 text-center">
      <p
        className={`text-sm font-semibold text-ink ${
          truncate ? "truncate" : ""
        }`}
        title={truncate ? value : undefined}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-ink/55">
        {label}
      </p>
    </div>
  );
}
