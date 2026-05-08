import { getTranslations } from "next-intl/server";
import { Plus, Sparkles, LayoutGrid } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import type { ClosetPiece } from "@prisma/client";
import { transformedUrl } from "@/lib/adapters/cloudinary";

const FILTER_KEYS = [
  "all",
  "TOPS",
  "BOTTOMS",
  "OUTERWEAR",
  "DRESSES",
  "SHOES",
  "BAGS",
  "ACCESSORIES",
] as const;

type Stats = {
  total: number;
  unworn: number;
  mostWorn: { id: string; name: string | null; wearCount: number } | null;
  forgotten: { id: string; name: string | null } | null;
  colorCore: string[];
  colorCorePct: number;
};

// Server component. Mirrors WardrobeGallery (frame 09): header with piece
// count + + button, AI insight banner, 3-card stats strip, filter chips,
// 3-col grid with category tag + wear count corner.
export async function ClosetGallery({
  pieces,
  stats,
  activeFilter,
}: {
  pieces: ClosetPiece[];
  stats: Stats;
  activeFilter: string;
}) {
  const t = await getTranslations("closet");
  const tFilters = await getTranslations("closet.filters");

  return (
    <div className="mx-auto w-full max-w-[460px] px-5 pt-8 pb-32 sm:max-w-[520px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
            {t("headerStat", { total: stats.total, unworn: stats.unworn })}
          </p>
          <h1 className="mt-1 text-[30px] font-bold leading-none tracking-[-0.02em] text-ink">
            {t.rich("header", {
              accent: (chunks) => (
                <span className="font-light text-primary">{chunks}</span>
              ),
            })}
          </h1>
        </div>
        <Link
          href="/closet/add"
          aria-label={t("addPiece")}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-paper transition-transform hover:scale-105"
        >
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>

      {/* Paired action cards — frame 09's primary CTAs. Dark "Build a look"
         routes into the slot-based composer; magenta "Ask the stylist"
         routes into the chat. Two equal-weight paths to making outfits. */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          href="/closet/builder"
          className="flex min-h-[110px] flex-col gap-2.5 rounded-[18px] bg-ink p-3.5 text-paper shadow-[0_6px_20px_rgba(33,39,57,0.18)] transition-colors hover:bg-ink/90"
        >
          <span
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-xl bg-paper/[0.14] text-paper"
          >
            <LayoutGrid size={16} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[14px] font-semibold leading-[1.2] tracking-[-0.01em] text-paper">
              {t("actionBuildTitle")}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-paper/55">
              {t("actionBuildSub")}
            </p>
          </div>
        </Link>
        <Link
          href="/stylist"
          className="flex min-h-[110px] flex-col gap-2.5 rounded-[18px] bg-[#FCE3EE] p-3.5 transition-colors hover:bg-[#fadce8]"
        >
          <span
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-paper"
          >
            <Sparkles size={16} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[14px] font-semibold leading-[1.2] tracking-[-0.01em] text-[#7A013D]">
              {t("actionAskTitle")}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[#A50253]">
              {t("actionAskSub")}
            </p>
          </div>
        </Link>
      </div>

      {/* Stats strip */}
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <StatCard
          k={t("stats.mostWorn")}
          v={stats.mostWorn?.name ?? "—"}
          m={
            stats.mostWorn
              ? t("stats.wearTimes", { n: stats.mostWorn.wearCount })
              : t("stats.noWears")
          }
        />
        <StatCard
          k={t("stats.forgotten")}
          v={stats.forgotten?.name ?? "—"}
          m={stats.forgotten ? t("stats.thisYear") : "—"}
        />
        <StatCard
          k={t("stats.colorCore")}
          v={stats.colorCore.length ? stats.colorCore.join(" + ") : "—"}
          m={
            stats.colorCore.length
              ? t("stats.pct", { n: stats.colorCorePct })
              : "—"
          }
        />
      </div>

      {/* Filter chips */}
      <div className="scrollbar-hide -mx-5 mt-4 flex gap-1.5 overflow-x-auto px-5">
        {FILTER_KEYS.map((key) => {
          const isActive = activeFilter === key;
          const href =
            key === "all"
              ? ("/closet" as const)
              : (`/closet?cat=${key}` as const);
          return (
            <Link
              key={key}
              href={href}
              className={[
                "whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium tracking-[-0.01em] transition-colors",
                isActive
                  ? "border-ink bg-ink text-paper"
                  : "border-ink/15 bg-paper text-ink/70 hover:border-ink/40",
              ].join(" ")}
            >
              {tFilters(key)}
            </Link>
          );
        })}
      </div>

      {/* Grid */}
      {pieces.length === 0 ? (
        <p className="mt-10 text-center text-[13px] text-ink-soft">
          {t("noResults")}
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {pieces.map((p) => (
            <li key={p.id}>
              <Tile p={p} catLabel={tFilters(p.category)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCard({ k, v, m }: { k: string; v: string; m: string }) {
  return (
    <div className="rounded-2xl bg-paper px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink/55">
        {k}
      </p>
      <p className="mt-1 truncate text-[12.5px] font-semibold leading-tight tracking-[-0.01em] text-ink">
        {v}
      </p>
      <p className="mt-0.5 font-mono text-[10px] text-primary">{m}</p>
    </div>
  );
}

function Tile({ p, catLabel }: { p: ClosetPiece; catLabel: string }) {
  return (
    <Link href={`/closet/${p.id}`} className="block">
      <div
        className="relative aspect-square overflow-hidden rounded-xl"
        style={{ background: p.swatchHex ?? "#C9CDD6" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={transformedUrl(p.publicId, 320)}
          alt={p.name ?? catLabel}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <span className="absolute start-1.5 top-1.5 rounded-md bg-paper/85 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.08em] text-ink backdrop-blur">
          {catLabel}
        </span>
        {p.wearCount > 0 && (
          <span className="absolute end-1.5 top-1.5 rounded-md bg-ink/55 px-1.5 py-0.5 font-mono text-[8px] text-paper backdrop-blur">
            {p.wearCount}×
          </span>
        )}
      </div>
      <div className="mt-1.5 px-0.5">
        <p className="truncate text-[11px] leading-tight text-ink">
          {p.name ?? "—"}
        </p>
        <p className="mt-0.5 truncate font-mono text-[9px] text-ink/55">
          {[p.fabric, p.color].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
    </Link>
  );
}
