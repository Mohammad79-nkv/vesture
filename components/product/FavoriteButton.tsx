"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/config";
import { toggleFavoriteAction } from "@/app/[locale]/(shop)/products/[slug]/actions";

export function FavoriteButton({
  productId,
  initial,
  authenticated,
  locale,
}: {
  productId: string;
  initial: boolean;
  authenticated: boolean;
  locale: Locale;
}) {
  const t = useTranslations("product");
  const router = useRouter();
  const [favorited, setFavorited] = useState(initial);
  const [pending, startTransition] = useTransition();

  function onClick() {
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
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="border border-ink py-3 text-sm uppercase tracking-wider hover:bg-ink hover:text-paper disabled:opacity-50"
    >
      {favorited ? t("removeFromFavorites") : t("addToFavorites")}
    </button>
  );
}
