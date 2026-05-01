"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/config";
import { toggleFavoriteAction } from "@/app/[locale]/(shop)/products/[slug]/actions";

// Sticky bottom bar with a square Save button and a flex-1 dark Message CTA
// per the design. Hides the bottom site nav while it's mounted by virtue of
// the parent route opting out.
export function MobileProductFooter({
  productId,
  initiallyFavorited,
  authenticated,
  locale,
  sellerHandle,
  channelUrl,
}: {
  productId: string;
  initiallyFavorited: boolean;
  authenticated: boolean;
  locale: Locale;
  sellerHandle: string;
  channelUrl: string | null;
}) {
  const t = useTranslations("product");
  const router = useRouter();
  const [favorited, setFavorited] = useState(initiallyFavorited);
  const [pending, startTransition] = useTransition();

  function onToggleFavorite() {
    if (!authenticated) {
      router.push("/sign-in", { locale });
      return;
    }
    startTransition(async () => {
      const res = await toggleFavoriteAction(productId);
      setFavorited(res.favorited);
    });
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-mist via-mist/80 to-transparent px-3.5 pt-3 pb-7 lg:hidden"
      style={{ paddingBottom: "calc(1.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="pointer-events-auto flex gap-2">
        <button
          type="button"
          onClick={onToggleFavorite}
          disabled={pending}
          aria-pressed={favorited}
          aria-label={favorited ? t("saved") : t("save")}
          className={[
            "grid h-[50px] w-[50px] place-items-center rounded-2xl border border-ink/10 transition-colors",
            favorited ? "bg-ink text-paper" : "bg-paper text-ink",
          ].join(" ")}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={favorited ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        {channelUrl ? (
          <a
            href={channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl bg-ink text-[13px] font-semibold uppercase tracking-[0.06em] text-paper hover:bg-ink/90"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="18" cy="6" r="1" fill="currentColor" />
            </svg>
            {t("messageCta", { handle: sellerHandle })}
          </a>
        ) : (
          <span
            aria-disabled="true"
            className="flex h-[50px] flex-1 items-center justify-center rounded-2xl bg-ink/40 text-[13px] font-semibold uppercase tracking-[0.06em] text-paper/80"
          >
            {t("contactSeller")}
          </span>
        )}
      </div>
    </div>
  );
}
