import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth";
import { AdminTopBar } from "@/components/admin/AdminTopBar";

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const user = await requireUser();
  if (user.role !== "ADMIN") redirect(`/${locale}`);

  return (
    <div className="flex flex-1 flex-col bg-mist">
      <AdminTopBar />
      {children}
    </div>
  );
}
