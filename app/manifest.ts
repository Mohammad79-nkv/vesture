import type { MetadataRoute } from "next";

// Next.js's manifest API. Returns the same JSON the browser
// fetches at /manifest.webmanifest, with type-safety on the
// shape. This is the single source of truth for installability —
// browsers (Chrome / Edge / Android home-screen / iOS Add-to-
// Home-Screen via meta tags) all read from it.
//
// Theme + background match the Today header (ink for chrome,
// paper for the page surface). Icons are SVG so we don't have to
// commit binary PNGs; modern install targets all support SVG
// manifest icons. The apple-touch-icon is generated separately
// via app/apple-icon.tsx (ImageResponse → PNG) for iOS Safari.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vesture — your closet, smarter",
    short_name: "Vesture",
    description:
      "AI-powered outfit picks from your own closet. Build looks, save them, log what you wore.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // background_color matches the SplashScreen overlay (ink) so
    // the iOS native pre-hydration splash hands off seamlessly
    // to the JS-rendered splash, which then fades to reveal the
    // paper page surface.
    background_color: "#212739",
    theme_color: "#212739",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    categories: ["lifestyle", "shopping", "personalization"],
  };
}
