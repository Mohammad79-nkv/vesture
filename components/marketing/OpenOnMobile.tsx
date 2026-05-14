import { getTranslations } from "next-intl/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/adapters/prisma";

// Desktop-only overlay. Vesture is mobile-first by design — the
// closet, today, builder, and stylist surfaces are all built for
// a ~390px viewport. On desktop we don't pretend the layout
// fits; we funnel the user to install the PWA on their phone
// instead.
//
// Mount strategy: this component lives in the root locale layout
// and is `fixed inset-0 hidden lg:flex z-[100]` so on screens
// ≥1024px it covers the entire app with this landing page, and
// on smaller screens it disappears entirely (the real app
// renders underneath).
//
// Role gate: only BUYER users see this overlay. Sellers + admins
// have legit desktop surfaces (/dashboard, /admin) and signed-
// out visitors should see the marketing landing without it
// covering the page.
//
// Server component — no interactivity needed. The faux QR grid
// is pre-computed deterministically below; floating + spin
// animations come from keyframes in globals.css.

export async function OpenOnMobile() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  const dbUser = await prisma.user.findUnique({
    where: { clerkId },
    select: { role: true },
  });
  if (dbUser?.role !== "BUYER") return null;

  const t = await getTranslations("openOnMobile");

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[100] hidden lg:flex flex-col bg-mist text-ink overflow-hidden"
      style={{ fontFamily: "var(--font-latin), system-ui, sans-serif" }}
    >
      {/* Subtle grid backdrop */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(33,39,57,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(33,39,57,0.04) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Stage — two-column grid; left = copy, right = phone mockup */}
      <main className="relative z-[1] grid flex-1 grid-cols-[1.05fr_1fr] items-center gap-14 px-16 py-10">
        {/* LEFT COLUMN */}
        <section className="max-w-[560px]">
          {/* Lockup */}
          <div className="mb-12 inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-2 text-[18px] font-bold tracking-[-0.04em]">
              <span className="grid h-[22px] w-[22px] place-items-center text-ink">
                <svg
                  viewBox="0 0 100 100"
                  width="100%"
                  height="100%"
                  aria-hidden="true"
                >
                  <path
                    d="M10 10 L50 90 L90 10 L75 10 L50 60 L25 10 Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              Vesture
            </span>
          </div>

          {/* Pulse kicker */}
          <span className="inline-flex items-center gap-2 rounded-full border border-ink/[0.08] bg-paper px-3 py-[7px] font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full bg-primary"
              style={{ animation: "om-pulse 1.6s ease-in-out infinite" }}
            />
            {t("kicker")}
          </span>

          {/* Headline */}
          <h1 className="mt-7 text-[80px] font-bold leading-[0.92] tracking-[-0.04em]">
            {t("headlineLine1")}
            <br />
            {t("headlineLine2Lead")}{" "}
            <span className="font-light italic text-primary">
              {t("headlineLine2Accent")}
            </span>
          </h1>

          {/* Lede */}
          <p className="mt-7 max-w-[480px] text-[17px] leading-[1.5] text-ink-soft text-pretty">
            {t("lede")}
          </p>

          {/* 4-step grid */}
          <div className="mt-9 grid max-w-[480px] grid-cols-2 gap-2">
            {[
              { num: "01", title: t("steps.scan.title"), sub: t("steps.scan.sub") },
              { num: "02", title: t("steps.text.title"), sub: t("steps.text.sub") },
              { num: "03", title: t("steps.add.title"), sub: t("steps.add.sub") },
              { num: "04", title: t("steps.open.title"), sub: t("steps.open.sub") },
            ].map((s) => (
              <div
                key={s.num}
                className="flex items-center gap-3 rounded-2xl border border-ink/[0.08] bg-white p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-ink/[0.18]"
              >
                <span className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[11px] font-bold tracking-[0.04em] text-white">
                  {s.num}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold tracking-[-0.01em]">
                    {s.title}
                  </p>
                  <p className="mt-[3px] font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-soft">
                    {s.sub}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Footnote */}
          <div className="mt-8 flex items-center gap-3.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-soft">
            <span>{t("footnote.desktopSoon")}</span>
            <a
              href="#"
              className="border-b border-ink/[0.15] pb-px text-ink no-underline"
            >
              {t("footnote.notify")} →
            </a>
          </div>
        </section>

        {/* RIGHT COLUMN */}
        <aside className="relative flex h-full items-center justify-center">
          {/* Floating annotations around the phone */}
          <span
            className="absolute left-[6%] top-[18%] inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft"
          >
            <span className="inline-block h-[5px] w-[5px] rounded-full bg-primary" />
            {t("annot.tapToSwap")}
            <span
              aria-hidden="true"
              className="h-px w-[50px] bg-ink-soft"
              style={{ transform: "rotate(20deg)" }}
            />
          </span>
          <span className="absolute right-[4%] top-[38%] inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            <span
              aria-hidden="true"
              className="h-px w-[50px] bg-ink-soft"
              style={{ transform: "rotate(-15deg)" }}
            />
            <span
              className="inline-block h-[5px] w-[5px] rounded-full"
              style={{ background: "#34889E" }}
            />
            {t("annot.weather")}
          </span>
          <span className="absolute bottom-[22%] left-[8%] inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            <span
              className="inline-block h-[5px] w-[5px] rounded-full"
              style={{ background: "#F291BB" }}
            />
            {t("annot.allOwn")}
            <span
              aria-hidden="true"
              className="h-px w-[50px] bg-ink-soft"
              style={{ transform: "rotate(-25deg)" }}
            />
          </span>

          {/* Phone */}
          <div
            className="relative"
            style={{ animation: "om-float 6s ease-in-out infinite" }}
          >
            <div
              className="relative h-[660px] w-[320px] rounded-[48px] bg-[#1a1a22] p-3"
              style={{
                boxShadow:
                  "0 0 0 2px rgba(33,39,57,0.18), 0 40px 80px -20px rgba(33,39,57,0.35), 0 20px 40px -10px rgba(33,39,57,0.20)",
              }}
            >
              {/* Dynamic Island */}
              <div className="absolute left-1/2 top-[22px] z-[3] h-[26px] w-[100px] -translate-x-1/2 rounded-full bg-[#0a0a10]" />
              {/* Screen */}
              <div className="relative h-full w-full overflow-hidden rounded-[38px] bg-ink px-[22px] pb-[22px] pt-[60px] text-paper">
                <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.12em] text-paper/50">
                  {t("phone.eyebrow")}
                </p>
                <h2 className="text-[30px] font-bold leading-[0.95] tracking-[-0.03em]">
                  {t("phone.titleLine1")}
                  <br />
                  {t("phone.titleLine2Lead")}{" "}
                  <span
                    className="font-light italic"
                    style={{ color: "#F291BB" }}
                  >
                    {t("phone.titleLine2Accent")}
                  </span>
                </h2>

                {/* Outfit card — dark */}
                <div
                  className="mt-[22px] rounded-[18px] bg-[#2a2f42] p-3"
                  style={{
                    animation: "om-pop-in 0.6s ease-out 0.4s backwards",
                  }}
                >
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-[16px] font-bold tracking-[-0.02em]">
                      Soft.
                    </p>
                    <span
                      className="rounded-full bg-paper/10 px-2 py-[3px] font-mono text-[8px] uppercase tracking-[0.1em]"
                      style={{ color: "#F291BB" }}
                    >
                      {t("phone.allOwn")}
                    </span>
                  </div>
                  <div className="flex gap-[5px]">
                    {["#E6E9EE", "#5E6478", "#212739", "#9DCAD4"].map(
                      (sw, i) => (
                        <div
                          key={i}
                          className="h-[86px] flex-1 rounded-lg"
                          style={{ background: sw }}
                        />
                      ),
                    )}
                  </div>
                </div>
                {/* Outfit card — bright */}
                <div
                  className="mt-[10px] rounded-[18px] bg-white p-3 text-ink"
                  style={{
                    animation: "om-pop-in 0.6s ease-out 0.6s backwards",
                  }}
                >
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-[16px] font-bold tracking-[-0.02em]">
                      Sharp.
                    </p>
                    <span className="rounded-full bg-[#FCE3EE] px-2 py-[3px] font-mono text-[8px] uppercase tracking-[0.1em] text-primary">
                      {t("phone.allOwn")}
                    </span>
                  </div>
                  <div className="flex gap-[5px]">
                    {["#3A4055", "#212739", "#7A013D"].map((sw, i) => (
                      <div
                        key={i}
                        className="h-[70px] flex-1 rounded-lg"
                        style={{ background: sw }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Spinning "SCAN ME" sticker */}
          <div
            aria-hidden="true"
            className="absolute right-[12%] top-[8%] grid h-[92px] w-[92px] place-items-center rounded-full bg-primary text-white"
            style={{
              animation: "om-spin 18s linear infinite",
              boxShadow: "0 16px 40px -12px rgba(205,2,104,0.40)",
            }}
          >
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
              <defs>
                <path
                  id="om-sticker-circle"
                  d="M 50 50 m -36 0 a 36 36 0 1 1 72 0 a 36 36 0 1 1 -72 0"
                />
              </defs>
              <text
                fontFamily="JetBrains Mono, monospace"
                fontSize="10"
                letterSpacing="2.4"
                fill="#fff"
              >
                <textPath href="#om-sticker-circle">
                  {t("sticker.text")}
                </textPath>
              </text>
            </svg>
            <span className="absolute text-[22px]">↗</span>
          </div>

          {/* Faux QR card */}
          <div
            className="absolute bottom-[6%] right-[4%] w-[168px] rounded-[18px] border border-ink/[0.08] bg-white p-3.5"
            style={{
              animation: "om-float-sm 7s ease-in-out infinite",
              boxShadow: "0 12px 30px -10px rgba(33,39,57,0.18)",
              transform: "rotate(4deg)",
            }}
          >
            <FauxQR />
            <p className="mt-2.5 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-ink">
              {t("qr.url")}
              <br />
              <small className="text-ink-soft">{t("qr.scan")}</small>
            </p>
          </div>
        </aside>
      </main>

      {/* Footer bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[5] flex items-center justify-between border-t border-ink/[0.08] px-16 py-4 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft backdrop-blur"
        style={{ background: "rgba(242,244,247,0.85)" }}
      >
        <span>{t("footer.copyright")}</span>
        <div className="inline-flex gap-6">
          <span>{t("footer.build")}</span>
          <span>{t("footer.platform")}</span>
        </div>
      </div>
    </div>
  );
}

// Deterministic faux QR (matches the design's JS algorithm)
// — purely decorative; we swap in a real QR once a production
// short-link exists. Pseudo-random but stable per render so the
// pattern doesn't shimmer on hydration.
function FauxQR() {
  const N = 11;
  // PRNG matching the design's seed for visual parity.
  let seed = 7919;
  const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const cells: Array<{ off: boolean }> = [];
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const isCorner =
        (x < 3 && y < 3) ||
        (x > N - 4 && y < 3) ||
        (x < 3 && y > N - 4);
      if (isCorner) {
        const localX = x < 3 ? x : x - (N - 3);
        const localY = y < 3 ? y : y - (N - 3);
        const inMiddle = localX === 1 && localY === 1;
        cells.push({ off: inMiddle });
      } else {
        cells.push({ off: rand() > 0.5 });
      }
    }
  }
  return (
    <div
      className="grid aspect-square w-full gap-[2px] rounded-[10px] border border-ink/[0.08] bg-white p-1.5"
      style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}
    >
      {cells.map((c, i) => (
        <span
          key={i}
          className="rounded-[1px]"
          style={{ background: c.off ? "transparent" : "#212739" }}
        />
      ))}
    </div>
  );
}
