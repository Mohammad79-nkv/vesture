import { getTranslations } from "next-intl/server";
import { Plus, LogIn } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";

const stripes =
  "repeating-linear-gradient(135deg, rgba(33,39,57,0.05) 0 1px, transparent 1px 9px)";

const PANELS = [
  { color: "#212739", label: "pants", x: 12, y: 24, w: 70, h: 100, r: -6 },
  { color: "#E6E9EE", label: "shirt", x: 95, y: 14, w: 78, h: 90, r: 4 },
  { color: "#C9CDD6", label: "coat", x: 188, y: 40, w: 85, h: 130, r: -3 },
  { color: "#7A013D", label: "shoes", x: 38, y: 158, w: 90, h: 64, r: 2 },
  { color: "#34889E", label: "tote", x: 155, y: 178, w: 70, h: 70, r: -4 },
];

// Frame 06 · WardrobeEmpty. The CTA's destination depends on auth: signed-in
// users go straight to /closet/add, signed-out users get nudged to /sign-in
// first since uploads need a userId.
export async function EmptyClosetIntro({ signedIn }: { signedIn: boolean }) {
  const t = await getTranslations("closetEmpty");

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-5 pt-10 sm:max-w-[460px] sm:pt-14">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
        {t("step")}
      </p>
      <h1 className="mt-1 text-[32px] font-bold leading-none tracking-[-0.02em] text-ink">
        {t("headlineLead")}{" "}
        <span className="font-light text-primary">{t("headlineAccent")}</span>{" "}
        {t("headlineTrail")}.
      </h1>
      <p className="mt-4 max-w-[320px] text-[14px] leading-[1.5] text-ink-soft">
        {t("body")}
      </p>

      <div
        aria-hidden="true"
        className="relative mt-6 h-[280px] overflow-hidden rounded-3xl bg-paper p-[18px] shadow-[inset_0_0_0_1px_rgba(33,39,57,0.06)]"
      >
        {PANELS.map((p) => (
          <div
            key={p.label}
            className="absolute overflow-hidden rounded-[10px] shadow-[0_4px_16px_rgba(33,39,57,0.10)]"
            style={{
              left: p.x,
              top: p.y,
              width: p.w,
              height: p.h,
              transform: `rotate(${p.r}deg)`,
              background: p.color,
              backgroundImage: stripes,
            }}
          >
            <span className="absolute bottom-1.5 start-1.5 text-[8px] font-medium uppercase tracking-[0.04em] text-paper/75">
              {p.label}
            </span>
          </div>
        ))}

        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, #CD0268, transparent)",
            boxShadow: "0 0 18px #CD0268",
          }}
        />
      </div>

      <ul className="mt-5 flex flex-col gap-2.5">
        <Step n="01" title={t("step1Title")} body={t("step1Body")} />
        <Step n="02" title={t("step2Title")} body={t("step2Body")} />
        <Step n="03" title={t("step3Title")} body={t("step3Body")} />
      </ul>

      <div className="mb-32 mt-auto pt-6">
        <Link
          href={signedIn ? "/closet/add" : "/sign-in"}
          className="inline-flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[18px] bg-ink text-[13px] font-medium uppercase tracking-[0.06em] text-paper transition-colors hover:bg-ink/90"
        >
          {signedIn ? (
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
          ) : (
            <LogIn size={16} strokeWidth={2} aria-hidden="true" />
          )}
          {t("ctaStart")}
        </Link>
        <p className="mt-2.5 text-center font-mono text-[11px] text-ink/50">
          {t("importHint")}
        </p>
      </div>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3.5">
      <span className="w-[22px] shrink-0 pt-0.5 font-mono text-[11px] text-ink/55">
        {n}
      </span>
      <div className="flex-1">
        <p className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
          {title}
        </p>
        <p className="mt-px text-[12px] leading-[1.4] text-ink/55">{body}</p>
      </div>
    </li>
  );
}
