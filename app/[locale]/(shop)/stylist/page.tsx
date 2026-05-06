import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@clerk/nextjs/server";
import { isLocale } from "@/lib/i18n/config";
import { StylistChat, SignInWall } from "@/components/stylist/StylistChat";

// Stylist chat surface. Auth-gated for now (the 3-turn anonymous wall
// lands in milestone #7); signed-out visitors see the SignInWall while
// signed-in users get the full chat UI driven by /api/stylist.
export default async function StylistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const { userId } = await auth();

  if (!userId) {
    return (
      <main className="flex flex-1 flex-col bg-mist">
        <SignInWall />
      </main>
    );
  }

  return <StylistChat />;
}
