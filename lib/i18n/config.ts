export const locales = ["en", "ar", "fa"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeDirection: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
  fa: "rtl",
};

export const localeNames: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
  fa: "فارسی",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
