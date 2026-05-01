import Image from "next/image";
import { redirect, notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth";
import { getSellerByUserId } from "@/lib/services/seller";
import { listSellerProducts } from "@/lib/services/product";
import { formatPrice } from "@/lib/domain/money";

export default async function SellerProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const user = await requireUser();
  const seller = await getSellerByUserId(user.id);
  if (!seller || seller.status !== "APPROVED") {
    redirect(`/${locale}/dashboard/onboarding`);
  }

  const products = await listSellerProducts(seller.id);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-light">Your products</h1>
        <Link
          href="/dashboard/products/new"
          className="bg-ink px-5 py-2 text-sm uppercase tracking-wider text-paper"
        >
          + New product
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="py-16 text-center text-ink/60">
          No products yet. Add your first one.
        </p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {products.map((p) => (
            <li key={p.id} className="flex items-center gap-4 py-4">
              <div className="relative h-20 w-16 overflow-hidden bg-mist">
                {p.images[0] && (
                  <Image
                    src={p.images[0].url}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm">{p.titleEn}</p>
                <p className="text-xs text-ink/60">
                  {formatPrice(p.priceMinor, p.currency, locale)} · {p.status}
                </p>
              </div>
              <Link
                href={`/dashboard/products/${p.id}/edit`}
                className="text-xs uppercase tracking-wider text-ink/60 underline"
              >
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
