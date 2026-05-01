import type { ReactNode } from "react";

// Locale-aware <html>/<body> live in app/[locale]/layout.tsx so that the
// `lang` and `dir` attributes can read from the URL segment. This root
// layout is a pure pass-through.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
