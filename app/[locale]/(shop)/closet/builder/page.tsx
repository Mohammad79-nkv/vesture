import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/lib/i18n/config";
import { requireOnboarded } from "@/lib/auth";
import { listMyPieces } from "@/lib/services/closet";
import { OutfitBuilder } from "@/components/closet/OutfitBuilder";

// /closet/builder — empty canvas to compose a new outfit. Phase 3A: no
// AI scoring (the live pill on the canvas is rendered disabled). Phase
// 3B will wire the "Get AI feedback" button. Editing an existing outfit
// happens through the same component via /closet/styles/[id]/edit later;
// for now the create-only flow is fine.
export default async function OutfitBuilderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const user = await requireOnboarded();
  const pieces = await listMyPieces({ userId: user.id });

  // Hide the FloatingNav on this surface — the sticky save dock owns the
  // bottom slot, and the focused-task feel matches /stylist's pattern.
  // See components/ui/floating-nav.tsx for the path-based hide list.

  return <OutfitBuilder closetPieces={pieces} />;
}
