"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { locales, localeNames, type Locale } from "@/lib/i18n/config";

export function LocaleSwitcher() {
  const current = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-2 text-xs">
      {locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => router.replace(pathname, { locale: loc as Locale })}
          className={
            current === loc
              ? "font-medium underline underline-offset-4"
              : "text-ink/50 hover:text-ink"
          }
        >
          {localeNames[loc]}
        </button>
      ))}
    </div>
  );
}
