import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { isLocale } from "@/lib/i18n/config";

// Where Google (or any future SSO provider) drops the user after consent.
// Clerk's helper component reads the URL params, completes the sign-up /
// sign-in transfer dance, and redirects to the URLs we hand it.
//
// Visually we reuse the design's OBSplash aesthetic — full-screen ink with
// a magenta radial glow, VESTURE wordmark, animated bouncing dots — so the
// gap between Google's consent screen and the next Vesture page reads as a
// branded loading moment instead of a blank flash.
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

  const t = await getTranslations("ssoCallback");

  return (
    <main className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden bg-ink text-paper">
      <AuthenticateWithRedirectCallback
        signUpFallbackRedirectUrl="/onboarding/taste"
        signInFallbackRedirectUrl="/products"
      />

      {/* Keyframes scoped to this route — the dots fade between 30% and
         100% opacity so the loading reads as a heartbeat rather than a
         blink. */}
      <style>{`
        @keyframes ssoDot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Magenta ambient glow — same shape as the design's splash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(205,2,104,0.22) 0%, rgba(33,39,57,0) 60%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-5 text-center">
        <span className="font-bold tracking-[0.32em] text-[20px] text-paper">
          VESTURE
        </span>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/45">
          {t("tagline")}
        </p>

        <div className="mt-2 space-y-1.5">
          <p className="text-[24px] font-bold leading-tight tracking-[-0.02em]">
            {t("title")}
            <span className="font-light text-primary">.</span>
          </p>
          <p className="text-[12.5px] text-paper/60">{t("subtitle")}</p>
        </div>

        {/* Bouncing dots — three pulses staggered so the loading is visible
           even on a fast hop through the callback. */}
        <div className="mt-4 flex items-center gap-1.5" aria-label="loading">
          <Dot delay="0ms" />
          <Dot delay="160ms" />
          <Dot delay="320ms" />
        </div>
      </div>
    </main>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      aria-hidden="true"
      className="h-1.5 w-1.5 rounded-full bg-primary"
      style={{
        animation: "ssoDot 1.2s ease-in-out infinite",
        animationDelay: delay,
      }}
    />
  );
}
