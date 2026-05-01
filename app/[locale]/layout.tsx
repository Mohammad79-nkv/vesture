import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope, IBM_Plex_Sans_Arabic, Vazirmatn, Playfair_Display, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { ClerkProvider } from "@clerk/nextjs";
import { notFound } from "next/navigation";
import "../globals.css";
import { localeDirection, locales, type Locale } from "@/lib/i18n/config";
import { Nav } from "@/components/ui/Nav";
import { Footer } from "@/components/ui/Footer";
import { FloatingNav } from "@/components/ui/floating-nav";

const latin = Manrope({
  variable: "--font-latin",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const arabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const persian = Vazirmatn({
  variable: "--font-persian",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Display serif for the "shop" / "verified" accent words. Italic only.
const display = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
  display: "swap",
});

// Monospace for eyebrows, numbers, micro-copy per the design system.
const mono = JetBrains_Mono({
  variable: "--font-mono-display",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vesture",
  description: "Curated fashion from independent boutiques",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locales, locale)) notFound();

  setRequestLocale(locale);
  const dir = localeDirection[locale as Locale];

  return (
    <ClerkProvider>
      <html
        lang={locale}
        dir={dir}
        className={`${latin.variable} ${arabic.variable} ${persian.variable} ${display.variable} ${mono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col overflow-x-clip bg-mist text-ink">
          <NextIntlClientProvider>
            <Nav />
            {children}
            <Footer />
            <FloatingNav />
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
