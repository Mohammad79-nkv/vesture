import type { Locale } from "@/lib/i18n/config";

// Currencies whose smallest unit is the major unit (no fractions).
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND"]);
// Currencies with three decimal places (rare; mostly Gulf dinars).
const THREE_DECIMAL = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

function fractionDigits(currency: string): number {
  if (ZERO_DECIMAL.has(currency)) return 0;
  if (THREE_DECIMAL.has(currency)) return 3;
  return 2;
}

export function minorPerUnit(currency: string): number {
  return 10 ** fractionDigits(currency);
}

export function toMinor(amount: number, currency: string): number {
  return Math.round(amount * minorPerUnit(currency));
}

export function fromMinor(minor: number, currency: string): number {
  return minor / minorPerUnit(currency);
}

export function formatPrice(
  minor: number,
  currency: string,
  locale: Locale,
): string {
  const value = fromMinor(minor, currency);
  return new Intl.NumberFormat(locale === "ar" ? "ar" : "en", {
    style: "currency",
    currency,
    maximumFractionDigits: fractionDigits(currency),
  }).format(value);
}
