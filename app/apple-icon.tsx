import { ImageResponse } from "next/og";

// Apple touch icon — iOS Safari pulls this for "Add to Home
// Screen". Next.js auto-injects <link rel="apple-touch-icon">
// pointing at this route and renders the JSX below to PNG via
// ImageResponse at build time.
//
// Design matches the manifest SVG icons: ink #212739 background
// with a stylised V in brand magenta. No safe-area padding —
// iOS clips its own 18% rounded corners around the icon.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#212739",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          fontSize: 110,
          fontWeight: 700,
          color: "#CD0268",
          letterSpacing: "-0.04em",
        }}
      >
        V
      </div>
    ),
    {
      ...size,
    },
  );
}
