import { notFound, redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth";
import { TastePicker } from "@/components/onboarding/TastePicker";
import { STYLE_TAGS, type StyleTag } from "@/lib/domain/styleTags";

// Step 02 of the mandatory onboarding sequence. Auth-gated — anonymous
// visitors are bounced to /sign-in by requireUser. Already-onboarded users
// who land here (via deep link or back navigation) are kicked to /products
// since the picker doesn't double as a settings screen — edits to taste
// later will live on /me.
export default async function OnboardingTastePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const user = await requireUser();
  if (user.onboardedAt) redirect("/products");

  const tShared = await getTranslations("onboarding");

  // Filter the persisted tags down to ones the picker still recognizes — keeps
  // the UI safe if STYLE_TAGS shrinks in the future.
  const initial = (user.styleTags as StyleTag[]).filter((tag) =>
    (STYLE_TAGS as readonly string[]).includes(tag),
  );

  return (
    <main className="flex flex-1 flex-col bg-mist text-ink">
      <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col px-5 pt-8 pb-32 sm:max-w-[520px] sm:pt-14">
        <div className="flex items-center">
          <Link
            href="/onboarding/sign-up"
            className="grid h-9 w-9 place-items-center rounded-full bg-ink/[0.04] text-ink hover:bg-ink/[0.08]"
            aria-label={tShared("back")}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-4 flex flex-1 flex-col">
          <TastePicker initial={initial} />
        </div>
      </div>
    </main>
  );
}
