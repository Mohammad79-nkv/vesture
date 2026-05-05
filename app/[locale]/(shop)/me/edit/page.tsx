import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth";
import { EditProfileForm } from "@/components/me/EditProfileForm";

// Custom in-app edit form for name + avatar. Email + password edits stay on
// Clerk's hosted account page (linked from /me's "Account & security" row in
// later iterations).
export default async function MeEditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  await requireUser();
  const t = await getTranslations("meEdit");

  return (
    <main className="flex flex-1 flex-col bg-mist text-ink">
      <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col px-5 pt-2 sm:max-w-[520px]">
        <Link
          href="/me"
          className="inline-flex items-center gap-1.5 self-start py-2 text-[12px] font-medium tracking-[-0.01em] text-ink/70 hover:text-ink"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          {t("back")}
        </Link>
        <EditProfileForm />
      </div>
    </main>
  );
}
