import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@clerk/nextjs/server";
import { isLocale } from "@/lib/i18n/config";
import { SignUpForm } from "@/components/onboarding/SignUpForm";

// Mandatory onboarding entry point. Linked from the welcome hero's "Start a
// brief" CTA. Already-signed-in users skip straight to the next step
// (taste) — they shouldn't see a sign-up form they don't need.
export default async function OnboardingSignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const { userId } = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (userId) redirect("/onboarding/taste" as any);

  return (
    <main className="flex flex-1 flex-col bg-mist text-ink">
      <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col px-5 pt-8 sm:max-w-[520px] sm:pt-14">
        <SignUpForm />
      </div>
    </main>
  );
}
