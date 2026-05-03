// Editorial collage backdrop for the welcome hero — the same set of rotated
// colored panels (45% opacity, big drop shadow) the design uses behind the
// dark navy background. Pure decoration, no interaction.
//
// The desktop variant uses the 5-panel layout from desktop-wardrobe.jsx;
// the mobile variant uses a denser 4-panel composition from
// wardrobe-onboarding.jsx. Coords are absolute in pixels per the design.

const stripes = "repeating-linear-gradient(135deg, rgba(33,39,57,0.05) 0 1px, transparent 1px 9px)";

const DESKTOP = [
  { c: "#CD0268", x: -80, y: 80, w: 360, h: 480, r: -5 },
  { c: "#34889E", x: 1140, y: 60, w: 340, h: 500, r: 5 },
  { c: "#C9CDD6", x: 1020, y: 580, w: 460, h: 340, r: -3 },
  { c: "#3A4055", x: 60, y: 600, w: 320, h: 340, r: 4 },
  { c: "#F291BB", x: 440, y: 720, w: 260, h: 200, r: -2 },
];

const MOBILE = [
  { c: "#CD0268", x: -30, y: 70, w: 180, h: 220, r: -8 },
  { c: "#34889E", x: 220, y: 40, w: 200, h: 260, r: 6 },
  { c: "#F291BB", x: 60, y: 290, w: 130, h: 130, r: -4 },
  { c: "#3A4055", x: 240, y: 320, w: 160, h: 180, r: 4 },
];

export function EditorialCollage({
  variant = "desktop",
  overlay = "radial",
}: {
  variant?: "desktop" | "mobile";
  overlay?: "radial" | "vertical";
}) {
  const panels = variant === "mobile" ? MOBILE : DESKTOP;
  const overlayBg =
    overlay === "vertical"
      ? "linear-gradient(180deg, rgba(33,39,57,0.55) 0%, rgba(33,39,57,0.4) 30%, rgba(33,39,57,0.97) 70%)"
      : "radial-gradient(ellipse at 50% 40%, rgba(33,39,57,0.15) 0%, rgba(33,39,57,0.92) 70%)";

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {panels.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,0.4)] opacity-45"
            style={{
              left: p.x,
              top: p.y,
              width: p.w,
              height: p.h,
              transform: `rotate(${p.r}deg)`,
              backgroundColor: p.c,
              backgroundImage: stripes,
            }}
          />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: overlayBg }}
      />
    </>
  );
}
