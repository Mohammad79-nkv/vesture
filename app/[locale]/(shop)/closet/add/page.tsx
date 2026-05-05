import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/lib/i18n/config";
import { requireOnboarded } from "@/lib/auth";
import { AddPieceForm } from "@/components/closet/AddPieceForm";

// Auth- and onboarding-gated capture flow. The form does the upload + tag +
// save in one place; `requireOnboarded` here means anonymous visitors get
// bounced to /sign-in and signed-in-but-not-onboarded users land on
// /onboarding/taste before they ever see the camera prompt.
export default async function AddPiecePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  await requireOnboarded();

  return (
    <main className="flex flex-1 flex-col bg-mist text-ink">
      <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col pt-8">
        <AddPieceForm />
      </div>
    </main>
  );
}
