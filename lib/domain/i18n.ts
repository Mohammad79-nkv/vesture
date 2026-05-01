import type { Locale } from "@/lib/i18n/config";

// Pick the best available bilingual value, falling back to English when the
// requested locale's value is missing. English is required at publish time so
// it always resolves to a string.
export function pickLocalized(
  values: { en: string; ar?: string | null },
  locale: Locale,
): string {
  if (locale === "ar" && values.ar && values.ar.trim().length > 0) {
    return values.ar;
  }
  return values.en;
}
