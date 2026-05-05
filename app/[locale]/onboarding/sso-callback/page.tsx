import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";

// Where Google (or any future SSO provider) drops the user after consent.
// Clerk's helper component reads the URL params, completes the sign-up /
// sign-in transfer dance, and redirects to the URLs we hand it.
//
// New users land on /onboarding/taste so they hit the mandatory step;
// returning users go to /products and the requireOnboarded() gate will
// catch them if they bailed mid-flow last time.
export default async function SsoCallbackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-mist text-ink">
      <AuthenticateWithRedirectCallback
        signUpFallbackRedirectUrl="/onboarding/taste"
        signInFallbackRedirectUrl="/products"
      />
      <Loader2 size={28} className="animate-spin text-primary" aria-hidden="true" />
    </main>
  );
}
