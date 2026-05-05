import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth";
import { AddPieceForm } from "@/components/closet/AddPieceForm";

// Auth-gated capture flow. The form does the upload + tag + save in one place;
// `requireUser` here means anonymous visitors get bounced to /sign-in before
// they ever see the camera prompt.
export default async function AddPiecePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  await requireUser();

  return (
    <main className="flex flex-1 flex-col bg-mist text-ink">
      <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col pt-8">
        <AddPieceForm />
      </div>
    </main>
  );
}
