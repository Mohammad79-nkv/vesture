import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@clerk/nextjs/server";
import { isLocale } from "@/lib/i18n/config";
import { StylistChat } from "@/components/stylist/StylistChat";

// Stylist chat surface. Open to anonymous visitors for a 3-turn trial —
// the wall is enforced server-side at /api/stylist and surfaces in the UI
// as a modal overlay (see StylistChat). Signed-in users skip the cap.
export default async function StylistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const { userId } = await auth();
  return <StylistChat signedIn={Boolean(userId)} />;
}
