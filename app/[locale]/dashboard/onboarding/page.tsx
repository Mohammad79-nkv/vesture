import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getSellerByUserId, submitSellerApplication } from "@/lib/services/seller";
import { isLocale } from "@/lib/i18n/config";
import { notFound } from "next/navigation";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const user = await requireUser();
  const existing = await getSellerByUserId(user.id);
  const t = await getTranslations("seller.onboarding");

  if (existing?.status === "APPROVED") {
    redirect(`/${locale}/dashboard`);
  }

  async function submit(formData: FormData) {
    "use server";
    const me = await requireUser();
    await submitSellerApplication(me.id, {
      storeNameEn: formData.get("storeNameEn"),
      storeNameAr: formData.get("storeNameAr") || undefined,
      bioEn: formData.get("bioEn") || undefined,
      bioAr: formData.get("bioAr") || undefined,
      countryCode: formData.get("countryCode"),
      defaultCurrency: formData.get("defaultCurrency"),
      instagramUrl: formData.get("instagramUrl") || undefined,
      whatsappE164: formData.get("whatsappE164") || undefined,
    });
    redirect(`/${locale}/dashboard/onboarding?submitted=1`);
  }

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-16">
      <h1 className="mb-2 text-3xl font-light">{t("title")}</h1>

      {existing?.status === "PENDING" && (
        <p className="mb-6 border-l-2 border-secondary bg-mist p-3 text-sm">{t("pending")}</p>
      )}
      {existing?.status === "REJECTED" && (
        <p className="mb-6 border-l-2 border-red-500 bg-red-50 p-3 text-sm">
          {t("rejected")}
          {existing.rejectionReason && <> — {existing.rejectionReason}</>}
        </p>
      )}

      <form action={submit} className="space-y-5">
        <Field
          name="storeNameEn"
          label={t("storeName")}
          required
          defaultValue={existing?.storeNameEn ?? ""}
        />
        <Field
          name="storeNameAr"
          label={t("storeNameAr")}
          defaultValue={existing?.storeNameAr ?? ""}
        />
        <Field
          name="countryCode"
          label={t("country")}
          required
          placeholder="AE"
          maxLength={2}
          uppercase
          defaultValue={existing?.countryCode ?? ""}
        />
        <Field
          name="defaultCurrency"
          label={t("currency")}
          required
          placeholder="AED"
          maxLength={3}
          uppercase
          defaultValue={existing?.defaultCurrency ?? ""}
        />
        <Field
          name="instagramUrl"
          label={t("instagram")}
          type="url"
          placeholder="https://instagram.com/yourshop"
          defaultValue={existing?.instagramUrl ?? ""}
        />
        <Field
          name="whatsappE164"
          label={t("whatsapp")}
          placeholder="+971501234567"
          defaultValue={existing?.whatsappE164 ?? ""}
        />
        <FieldArea name="bioEn" label="Bio (EN)" defaultValue={existing?.bioEn ?? ""} />
        <FieldArea name="bioAr" label="Bio (AR)" defaultValue={existing?.bioAr ?? ""} />

        <button
          type="submit"
          className="w-full bg-ink py-3 text-sm font-medium uppercase tracking-wider text-paper"
        >
          {t("submit")}
        </button>
      </form>
    </main>
  );
}

function Field({
  name,
  label,
  required,
  defaultValue,
  placeholder,
  type = "text",
  maxLength,
  uppercase,
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  uppercase?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-ink/60">
        {label}
        {required && " *"}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        defaultValue={defaultValue}
        className={`w-full border border-ink/20 bg-paper px-3 py-2 text-sm focus:border-ink focus:outline-none ${
          uppercase ? "uppercase" : ""
        }`}
      />
    </label>
  );
}

function FieldArea({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-ink/60">{label}</span>
      <textarea
        name={name}
        rows={3}
        defaultValue={defaultValue}
        className="w-full border border-ink/20 bg-paper px-3 py-2 text-sm focus:border-ink focus:outline-none"
      />
    </label>
  );
}
