import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { SoonScreen } from "@/components/seller/SoonScreen";

export default async function InsightsComingSoon({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("seller");
  const td = await getTranslations("seller.dashboard");
  return (
    <SoonScreen
      eyebrow={t("topBar.insights")}
      title={td("comingSoon")}
      body={td("comingSoonBody")}
    />
  );
}
