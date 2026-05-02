import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { SellerTopBar } from "@/components/seller/SellerTopBar";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <div className="flex flex-1 flex-col bg-mist">
      <SellerTopBar locale={locale} />
      {children}
    </div>
  );
}
