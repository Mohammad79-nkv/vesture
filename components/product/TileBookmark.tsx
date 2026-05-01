"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/config";
import { toggleFavoriteAction } from "@/app/[locale]/(shop)/products/[slug]/actions";

export function TileBookmark({
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
  const router = useRouter();
  const [active, setActive] = useState(initial);
  const [pending, startTransition] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!authenticated) {
      router.push("/sign-in", { locale });
      return;
    }
    startTransition(async () => {
      const res = await toggleFavoriteAction(productId);
      setActive(res.favorited);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={active}
      aria-label={active ? "Remove from favorites" : "Add to favorites"}
      className="absolute end-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-paper/90 text-ink shadow-sm backdrop-blur transition-colors hover:bg-paper disabled:opacity-60"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}
