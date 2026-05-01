import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth";
import { getSellerByUserId } from "@/lib/services/seller";
import {
  getProductForEdit,
  publishProduct,
  updateProduct,
} from "@/lib/services/product";
import { ProductForm, type ProductFormInitial } from "@/components/seller/ProductForm";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const user = await requireUser();
  const seller = await getSellerByUserId(user.id);
  if (!seller || seller.status !== "APPROVED") {
    redirect(`/${locale}/dashboard/onboarding`);
  }

  const product = await getProductForEdit({ sellerId: seller.id, productId: id });
  if (!product) notFound();

  const initial: ProductFormInitial = {
    id: product.id,
    titleEn: product.titleEn,
    titleAr: product.titleAr ?? "",
    descriptionEn: product.descriptionEn,
    descriptionAr: product.descriptionAr ?? "",
    priceMinor: product.priceMinor,
    currency: product.currency,
    category: product.category,
    gender: product.gender,
    season: product.season ?? undefined,
    occasion: product.occasion ?? undefined,
    style: product.style ?? undefined,
    sizes: product.sizes,
    colors: product.colors,
    images: product.images.map((img) => ({
      url: img.url,
      publicId: img.publicId,
      position: img.position,
    })),
  };

  async function save(payload: ProductFormInitial, intent: "draft" | "publish") {
    "use server";
    const me = await requireUser();
    const mySeller = await getSellerByUserId(me.id);
    if (!mySeller || mySeller.status !== "APPROVED") {
      return { ok: false as const, error: "Seller not approved" };
    }
    try {
      const updated = await updateProduct({
        sellerId: mySeller.id,
        productId: id,
        raw: payload,
      });
      if (intent === "publish") {
        await publishProduct({ sellerId: mySeller.id, productId: updated.id });
      }
      return { ok: true as const, slug: updated.slug };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Save failed",
      };
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-light">Edit product</h1>
      <ProductForm
        initial={initial}
        defaultCurrency={seller.defaultCurrency}
        onSubmit={save}
        locale={locale}
      />
    </main>
  );
}
