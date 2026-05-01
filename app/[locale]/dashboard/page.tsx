import { notFound, redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth";
import { getSellerByUserId } from "@/lib/services/seller";
import { listSellerProducts } from "@/lib/services/product";

export default async function DashboardHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const user = await requireUser();
  const seller = await getSellerByUserId(user.id);
  const t = await getTranslations("seller.onboarding");

  if (!seller) {
    redirect(`/${locale}/dashboard/onboarding`);
  }

  const products = seller.status === "APPROVED" ? await listSellerProducts(seller.id) : [];
  const published = products.filter((p) => p.status === "PUBLISHED").length;
  const drafts = products.filter((p) => p.status === "DRAFT").length;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-light">{seller.storeNameEn}</h1>
      <p className="mb-8 text-sm uppercase tracking-wider text-ink/60">
        Status: {seller.status}
      </p>

      {seller.status === "PENDING" && (
        <p className="mb-8 border-l-2 border-secondary bg-mist p-4 text-sm">{t("pending")}</p>
      )}
      {seller.status === "REJECTED" && (
        <div className="mb-8 border-l-2 border-red-500 bg-red-50 p-4 text-sm">
          <p>{t("rejected")}</p>
          {seller.rejectionReason && (
            <p className="mt-1 text-ink/70">{seller.rejectionReason}</p>
          )}
          <Link href="/dashboard/onboarding" className="mt-2 inline-block underline">
            Edit application
          </Link>
        </div>
      )}

      {seller.status === "APPROVED" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Published" value={published} />
          <Stat label="Drafts" value={drafts} />
          <Stat label="Currency" value={seller.defaultCurrency} />
        </div>
      )}

      {seller.status === "APPROVED" && (
        <div className="mt-8 flex gap-3">
          <Link
            href="/dashboard/products"
            className="border border-ink px-5 py-2 text-sm uppercase tracking-wider"
          >
            Manage products
          </Link>
          <Link
            href="/dashboard/products/new"
            className="bg-ink px-5 py-2 text-sm uppercase tracking-wider text-paper"
          >
            + New product
          </Link>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-ink/10 p-5">
      <p className="text-xs uppercase tracking-wider text-ink/60">{label}</p>
      <p className="mt-2 text-2xl font-light">{value}</p>
    </div>
  );
}
