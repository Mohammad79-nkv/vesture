import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/lib/i18n/config";
import { getOrCreateDbUser } from "@/lib/auth";
import { listMyPieces, getClosetStats } from "@/lib/services/closet";
import { closetFiltersSchema } from "@/lib/domain/schemas";
import { EmptyClosetIntro } from "@/components/closet/EmptyClosetIntro";
import { ClosetGallery } from "@/components/closet/ClosetGallery";

// /closet has three states:
//   1. Signed-out → empty intro with "Sign in to continue" CTA
//   2. Signed-in but pre-onboarding → bounce to /onboarding/taste
//   3. Signed-in, zero pieces → empty intro with "Start with one piece" CTA
//   4. Signed-in, at least one piece → gallery (frame 09)
export default async function ClosetPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const parsedFilters = closetFiltersSchema.safeParse({
    category: sp.cat,
    status: sp.status,
  });
  const filters = parsedFilters.success ? parsedFilters.data : {};

  const user = await getOrCreateDbUser();

  if (!user) {
    return (
      <main className="flex flex-1 flex-col bg-mist text-ink">
        <EmptyClosetIntro signedIn={false} />
      </main>
    );
  }

  // Signed-in but onboarding incomplete — kick to taste before the closet
  // gallery surfaces personal data.
  if (!user.onboardedAt) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    redirect("/onboarding/taste" as any);
  }

  const [pieces, stats] = await Promise.all([
    listMyPieces({
      userId: user.id,
      category: filters.category,
      status: filters.status,
    }),
    getClosetStats(user.id),
  ]);

  if (stats.total === 0) {
    return (
      <main className="flex flex-1 flex-col bg-mist text-ink">
        <EmptyClosetIntro signedIn={true} />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col bg-mist text-ink">
      <ClosetGallery
        pieces={pieces}
        stats={stats}
        activeFilter={filters.category ?? "all"}
      />
    </main>
  );
}
