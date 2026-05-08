import { Plus, Camera, Grid, AtSign } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { TodayTopBar } from "./TodayTopBar";
import { TodayHeader } from "./TodayHeader";

// Frame 00 · Empty closet. Renders when the user has zero pieces.
// No AI calls happen on this branch — pure layout pushing the user
// toward `/closet/add`. The phantom outfit silhouette communicates
// "your first outfit lives here" before they've added anything.
//
// Server-rendered (async) since there's no interactivity; uses the
// project's getTranslations() pattern instead of the client-only
// useTranslations hook.
export async function EmptyToday({ kicker }: { kicker: string }) {
  const t = await getTranslations("today.empty");

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-mist text-ink">
      <TodayTopBar kicker={kicker} />

      <TodayHeader
        kicker={t("kicker")}
        title={t("title")}
        sub={t("sub")}
      />

      {/* Phantom outfit silhouette */}
      <div className="px-5 pt-9">
        <div className="flex items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-ink/20 bg-paper p-4 h-[170px]">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="grid h-full flex-1 place-items-center rounded-[10px] bg-ink/[0.04]"
            >
              <Plus size={16} className="text-ink/55" aria-hidden="true" />
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-ink/55">
          {t("firstOutfit")}
        </p>
      </div>

      {/* Quick paths + primary CTA pinned just above the floating
         nav. fixed (not absolute) so they stay anchored to the
         viewport bottom while the page scrolls — the user keeps
         the action visible regardless of how far they scrolled the
         phantom-outfit hero above. The 100px offset matches frame
         00 and clears the floating nav (which sits at bottom-3 +
         ~60px tall); env(safe-area-inset-bottom) keeps clearance
         honest on iOS devices with a home indicator. */}
      <div
        className="fixed inset-x-4 z-10"
        style={{ bottom: "calc(100px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Camera, label: t("snap"), time: t("snapTime") },
            { icon: Grid, label: t("photos"), time: t("photosTime") },
            { icon: AtSign, label: t("instagram"), time: t("instagramTime") },
          ].map((m) => (
            <div
              key={m.label}
              className="flex flex-col gap-1.5 rounded-[16px] bg-paper p-3"
            >
              <m.icon size={18} className="text-ink" aria-hidden="true" />
              <span className="text-[12px] font-semibold tracking-[-0.01em] text-ink">
                {m.label}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink/55">
                {m.time}
              </span>
            </div>
          ))}
        </div>

        <Link
          href="/closet/add"
          className="mt-3 flex items-center justify-between rounded-[16px] bg-ink px-4 py-3.5 text-paper shadow-[0_8px_22px_rgba(33,39,57,0.22)]"
        >
          <div>
            <p className="text-[13px] font-semibold tracking-[-0.01em]">
              {t("cta")}
            </p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-paper/55">
              {t("ctaSub")}
            </p>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-paper text-ink">
            <Plus size={18} strokeWidth={2} aria-hidden="true" />
          </span>
        </Link>
      </div>
    </div>
  );
}
