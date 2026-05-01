"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/config";
import { toggleFavoriteAction } from "@/app/[locale]/(shop)/products/[slug]/actions";

// Single client island for size + message + favorite. Keeping these in one
// component avoids prop-drilling state through three server boundaries.
export function SizeAndContact({
  productId,
  productTitle,
  productUrl,
  sizes,
  sellerHandle,
  whatsappE164,
  instagramUrl,
  initiallyFavorited,
  authenticated,
  locale,
}: {
  productId: string;
  productTitle: string;
  productUrl: string;
  sizes: string[];
  sellerHandle: string;
  whatsappE164: string | null;
  instagramUrl: string | null;
  initiallyFavorited: boolean;
  authenticated: boolean;
  locale: Locale;
}) {
  const t = useTranslations("product");
  const router = useRouter();

  // Default-select the first available size if any.
  const [size, setSize] = useState<string | null>(sizes[0] ?? null);
  const [favorited, setFavorited] = useState(initiallyFavorited);
  const [pending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);

  const defaultMessage = useMemo(() => {
    if (size) {
      return t("messageDefault", { handle: sellerHandle, title: productTitle, size });
    }
    return t("messageDefaultNoSize", { handle: sellerHandle, title: productTitle });
  }, [size, sellerHandle, productTitle, t]);

  const [customMessage, setCustomMessage] = useState<string | null>(null);
  const message = customMessage ?? defaultMessage;

  // Final message we send: include the product URL so the seller can verify.
  const outgoing = `${message}\n${productUrl}`;
  const channelLabel = whatsappE164 ? t("weSendVia") : t("weSendInstagram");
  const channelUrl =
    whatsappE164
      ? `https://wa.me/${whatsappE164.replace(/^\+/, "")}?text=${encodeURIComponent(outgoing)}`
      : instagramUrl ?? null;

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
    <div className="space-y-6">
      {sizes.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink/55">
              {t("size")}
            </p>
            <button
              type="button"
              disabled
              className="text-xs text-primary disabled:opacity-60"
            >
              {t("sizeGuide")}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {sizes.map((s) => {
              const isActive = s === size;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={[
                    "rounded-lg border py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "border-ink bg-ink text-paper"
                      : "border-ink/15 bg-paper text-ink hover:border-ink",
                  ].join(" ")}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-2xl bg-mist p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-ink/55">
          {channelLabel}
        </p>
        {isEditing ? (
          <textarea
            value={message}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-ink/15 bg-paper p-3 text-sm focus:border-ink focus:outline-none"
          />
        ) : (
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink/85">
            {message}
          </p>
        )}
        <button
          type="button"
          onClick={() => setIsEditing((v) => !v)}
          className="mt-2 text-xs text-ink/60 hover:text-ink"
        >
          {isEditing ? t("doneEditing") : t("editMessage")}
        </button>
      </section>

      <div className="space-y-3">
        {channelUrl && (
          <a
            href={channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-paper hover:bg-ink/90"
          >
            <ChatIcon />
            {t("messageCta", { handle: sellerHandle })}
          </a>
        )}
        <button
          type="button"
          onClick={onToggleFavorite}
          disabled={pending}
          aria-pressed={favorited}
          className={[
            "flex w-full items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-medium",
            favorited
              ? "border-ink bg-ink text-paper"
              : "border-ink/20 bg-paper text-ink hover:border-ink",
          ].join(" ")}
        >
          <BookmarkIcon filled={favorited} />
          {favorited ? t("saved") : t("save")}
        </button>
      </div>
    </div>
  );
}

function ChatIcon() {
  return (
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
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
