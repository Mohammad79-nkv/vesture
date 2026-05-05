"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs/legacy";
import { useTranslations } from "next-intl";
import { ArrowRight, ChevronLeft, Loader2 } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";

const FIELD_INPUT_CLS =
  "h-12 w-full rounded-xl bg-paper px-3.5 text-[14px] text-ink shadow-[inset_0_0_0_1px_rgba(33,39,57,0.08)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1.5px_rgba(205,2,104,0.6)]";

type Stage = "form" | "verify";

// Custom-from-scratch Clerk sign-up: collects email/password/firstName, then
// (because Clerk requires it) drops to a 6-digit code verification step.
// On success the redirect lands the user on /onboarding/taste — the next
// frame in the mandatory onboarding flow.
export function SignUpForm() {
  const t = useTranslations("onboarding.signUp");
  const tShared = useTranslations("onboarding");
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [stage, setStage] = useState<Stage>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function clerkError(err: unknown, fallback: string): string {
    if (err && typeof err === "object" && "errors" in err) {
      const errors = (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
      const first = errors?.[0];
      return first?.longMessage ?? first?.message ?? fallback;
    }
    return fallback;
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isLoaded) return;
    if (!email.trim()) {
      setError(t("errors.emailRequired"));
      return;
    }
    if (password.length < 8) {
      setError(t("errors.passwordTooShort"));
      return;
    }
    startTransition(async () => {
      try {
        await signUp.create({
          emailAddress: email.trim(),
          password,
          firstName: firstName.trim() || undefined,
        });
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setStage("verify");
      } catch (err) {
        setError(clerkError(err, t("errors.generic")));
      }
    });
  }

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isLoaded) return;
    if (code.length < 6) {
      setError(t("errors.codeRequired"));
      return;
    }
    startTransition(async () => {
      try {
        const attempt = await signUp.attemptEmailAddressVerification({ code });
        if (attempt.status !== "complete" || !attempt.createdSessionId) {
          setError(t("errors.generic"));
          return;
        }
        await setActive({ session: attempt.createdSessionId });
        // Cast to any: typed-routes briefly lags newly-added route segments
        // even though the page exists at app/[locale]/onboarding/taste.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.replace("/onboarding/taste" as any);
        router.refresh();
      } catch (err) {
        setError(clerkError(err, t("errors.generic")));
      }
    });
  }

  async function resend() {
    if (!isLoaded) return;
    setError(null);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    } catch (err) {
      setError(clerkError(err, t("errors.generic")));
    }
  }

  // Google OAuth — redirects out to Google, lands on /onboarding/sso-callback
  // which Clerk's <AuthenticateWithRedirectCallback> resolves to either
  // /onboarding/taste (new account) or /products (returning user).
  async function continueWithGoogle() {
    if (!isLoaded) return;
    setError(null);
    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/onboarding/sso-callback",
        redirectUrlComplete: "/onboarding/taste",
      });
    } catch (err) {
      setError(clerkError(err, t("errors.generic")));
    }
  }

  // ── Verification step ────────────────────────────────────────────────
  if (stage === "verify") {
    return (
      <form onSubmit={submitCode} className="flex flex-1 flex-col">
        <button
          type="button"
          onClick={() => setStage("form")}
          className="inline-flex items-center gap-1.5 self-start py-2 text-[12px] font-medium tracking-[-0.01em] text-ink/70 hover:text-ink"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          {tShared("back")}
        </button>

        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          {t("verifyEyebrow")}
        </p>
        <h1 className="mt-1.5 text-[30px] font-bold leading-none tracking-[-0.02em] text-ink">
          {t.rich("verifyHeadline", {
            accent: (chunks) => (
              <span className="font-light text-primary">{chunks}</span>
            ),
          })}
        </h1>
        <p className="mt-3 max-w-[320px] text-[13.5px] leading-[1.5] text-ink-soft">
          {t("verifyBody", { email })}
        </p>

        <div className="mt-6">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
              {t("code")}
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder={t("codePlaceholder")}
              className={`${FIELD_INPUT_CLS} text-center text-[20px] tracking-[0.4em] font-mono`}
            />
          </label>
        </div>

        {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

        <div id="clerk-captcha" />

        <div className="mt-auto flex flex-col gap-3 pt-8 pb-6">
          <button
            type="submit"
            disabled={pending || code.length < 6}
            className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[13px] font-medium uppercase tracking-[0.06em] text-paper disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                {t("verifying")}
              </>
            ) : (
              <>
                {t("verify")}
                <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={resend}
            className="text-center font-mono text-[11px] uppercase tracking-[0.08em] text-ink/55 hover:text-ink"
          >
            {t("resend")}
          </button>
        </div>
      </form>
    );
  }

  // ── Initial form ──────────────────────────────────────────────────────
  return (
    <form onSubmit={submitForm} className="flex flex-1 flex-col">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
        {tShared("step", { n: 1, total: 4 })}
      </p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
        {t("eyebrow")}
      </p>
      <h1 className="mt-1.5 text-[34px] font-bold leading-[0.98] tracking-[-0.025em] text-ink">
        {t.rich("headline", {
          accent: (chunks) => (
            <span className="font-light text-primary">{chunks}</span>
          ),
        })}
        <br />
        <span className="font-light text-primary">{t("subhead")}</span>
      </h1>
      <p className="mt-3 max-w-[320px] text-[13.5px] leading-[1.5] text-ink-soft">
        {t("body")}
      </p>

      {/* Social sign-up — Google. Uses Clerk OAuth under the hood; the
         provider must be enabled in the Clerk dashboard for the redirect to
         resolve, otherwise users hit Clerk's hosted error page. */}
      <button
        type="button"
        onClick={continueWithGoogle}
        disabled={pending || !isLoaded}
        className="mt-6 inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl bg-paper text-[13.5px] font-semibold tracking-[-0.01em] text-ink shadow-[inset_0_0_0_1px_rgba(33,39,57,0.12)] transition-colors hover:bg-mist disabled:opacity-50"
      >
        <GoogleIcon />
        {t("continueWithGoogle")}
      </button>

      <div
        className="my-5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45"
        role="separator"
      >
        <span aria-hidden="true" className="h-px flex-1 bg-ink/10" />
        {t("or")}
        <span aria-hidden="true" className="h-px flex-1 bg-ink/10" />
      </div>

      <div className="flex flex-col gap-4">
        <Field label={t("email")}>
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className={FIELD_INPUT_CLS}
            required
          />
        </Field>
        <Field label={t("password")}>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
            className={FIELD_INPUT_CLS}
            minLength={8}
            required
          />
        </Field>
        <Field label={t("firstName")}>
          <input
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder={t("firstNamePlaceholder")}
            maxLength={40}
            className={FIELD_INPUT_CLS}
          />
        </Field>
      </div>

      {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

      {/* Clerk Smart-CAPTCHA mounts inside this element when challenged. It
         stays empty until Clerk decides one is needed; the styling below
         keeps it from collapsing the layout when present. */}
      <div id="clerk-captcha" className="mt-3 empty:hidden" />

      <div className="mt-auto flex flex-col gap-3 pt-6 pb-6">
        <button
          type="submit"
          disabled={pending || !isLoaded}
          className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[13px] font-medium uppercase tracking-[0.06em] text-paper disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              {t("creatingAccount")}
            </>
          ) : (
            <>
              {t("createAccount")}
              <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
            </>
          )}
        </button>
        <p className="text-center text-[12px] text-ink-soft">
          {t("haveAccount")}{" "}
          <Link
            href="/sign-in"
            className="font-semibold text-primary hover:underline"
          >
            {t("signInLink")}
          </Link>
        </p>
        <p className="text-center font-mono text-[10px] text-ink/45">
          {t("termsHint")}
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
        {label}
      </span>
      {children}
    </label>
  );
}

// Brand-colored Google "G" mark. Inlined as SVG so we don't pull a separate
// icon library or fetch a remote asset on every page render.
function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.6v3h3.86c2.26-2.08 3.58-5.15 3.58-8.84z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.92l-3.86-3a7.18 7.18 0 0 1-10.74-3.78H1.34v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.33 14.3a7.21 7.21 0 0 1 0-4.6V6.6H1.34a12 12 0 0 0 0 10.8l3.99-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.78c1.77 0 3.35.61 4.6 1.8l3.42-3.42A12 12 0 0 0 1.34 6.6l3.99 3.1A7.18 7.18 0 0 1 12 4.78z"
      />
    </svg>
  );
}
