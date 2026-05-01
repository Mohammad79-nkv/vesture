import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";

export async function Footer() {
  const t = await getTranslations("footer");
  const tBrand = await getTranslations("brand");

  // Routes that exist today get real Links; the rest render as inert spans
  // until the corresponding feature ships.
  const buyerLinks: { label: string; href?: "/products" | "/stylist" | "/favorites" }[] = [
    { label: t("links.discover"), href: "/products" },
    { label: t("links.stylist"), href: "/stylist" },
    { label: t("links.savedBoards"), href: "/favorites" },
    { label: t("links.styleProfile") },
  ];

  const sellerLinks: { label: string; href?: "/dashboard" }[] = [
    { label: t("links.openShop"), href: "/dashboard" },
    { label: t("links.instagramBot") },
    { label: t("links.pricing") },
    { label: t("links.api") },
  ];

  const companyLinks: { label: string; href?: undefined }[] = [
    { label: t("links.about") },
    { label: t("links.editorial") },
    { label: t("links.press") },
    { label: t("links.contact") },
  ];

  return (
    <footer className="bg-ink text-paper/80">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="text-lg font-extrabold tracking-[0.18em] text-paper">
            {tBrand("name").toUpperCase()}
          </p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-paper/55">
            {t("tagline")}
          </p>
        </div>

        <FooterColumn title={t("buyers")} items={buyerLinks} />
        <FooterColumn title={t("sellers")} items={sellerLinks} />
        <FooterColumn title={t("company")} items={companyLinks} />
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  items,
}: {
  title: string;
  items: { label: string; href?: string }[];
}) {
  return (
    <div>
      <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.22em] text-paper/45">
        {title}
      </p>
      <ul className="space-y-3 text-sm">
        {items.map((item) => (
          <li key={item.label}>
            {item.href ? (
              <Link
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                href={item.href as any}
                className="text-paper/85 hover:text-paper"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="cursor-not-allowed text-paper/40"
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
