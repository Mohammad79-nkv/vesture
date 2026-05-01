import { redirect, notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth";
import { getSellerByUserId } from "@/lib/services/seller";
import { createProduct, publishProduct } from "@/lib/services/product";
import { ProductForm, type ProductFormInitial } from "@/components/seller/ProductForm";

export default async function NewProductPage({
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

  async function save(payload: ProductFormInitial, intent: "draft" | "publish") {
    "use server";
    const me = await requireUser();
    const mySeller = await getSellerByUserId(me.id);
    if (!mySeller || mySeller.status !== "APPROVED") {
      return { ok: false as const, error: "Seller not approved" };
    }
    try {
      const product = await createProduct({ sellerId: mySeller.id, raw: payload });
      if (intent === "publish") {
        await publishProduct({ sellerId: mySeller.id, productId: product.id });
      }
      return { ok: true as const, slug: product.slug };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Save failed",
      };
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-light">New product</h1>
      <ProductForm
        defaultCurrency={seller.defaultCurrency}
        onSubmit={save}
        locale={locale}
      />
    </main>
  );
}
