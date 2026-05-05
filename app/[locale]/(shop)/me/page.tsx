import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { currentUser } from "@clerk/nextjs/server";
import {
  Pencil,
  ChevronRight,
  LayoutGrid,
  Bookmark,
  Store,
  ShieldCheck,
  Package,
} from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireOnboarded } from "@/lib/auth";
import { prisma } from "@/lib/adapters/prisma";
import { SignOutRow } from "@/components/me/SignOutRow";

// /me is the buyer-side personal hub — accessible from the FloatingNav "Me"
// tab. Auth-gated; the empty surface for signed-out visitors lives at
// /sign-in via requireUser. Role-aware rows surface seller / admin entries
// for the few users who have those scopes.
export default async function MePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const dbUser = await requireOnboarded();
  const clerkUser = await currentUser();
  const t = await getTranslations("me");

  // Header data
  const fullName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    clerkUser?.username ||
    t("anonymous");
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? dbUser.email;
  const avatarUrl = clerkUser?.imageUrl ?? null;
  const initial = fullName.trim().charAt(0).toUpperCase() || "U";

  const joinedFmt = new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
  }).format(dbUser.createdAt);

  // Stats: closet pieces (active only), favorites, total wears across pieces.
  const [piecesCount, favoritesCount, wearsAgg] = await Promise.all([
    prisma.closetPiece.count({
      where: { userId: dbUser.id, status: "IN_CLOSET" },
    }),
    prisma.favorite.count({ where: { userId: dbUser.id } }),
    prisma.closetPiece.aggregate({
      where: { userId: dbUser.id },
      _sum: { wearCount: true },
    }),
  ]);
  const wearsTotal = wearsAgg._sum.wearCount ?? 0;

  return (
    <main className="flex flex-1 flex-col bg-mist text-ink">
      <div className="mx-auto w-full max-w-[460px] px-5 pt-8 pb-32 sm:max-w-[520px]">
        {/* Profile header */}
        <div className="flex items-start gap-4">
          <div className="relative">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={fullName}
                className="h-20 w-20 rounded-full object-cover shadow-[inset_0_0_0_1px_rgba(33,39,57,0.08)]"
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid h-20 w-20 place-items-center rounded-full bg-primary text-[28px] font-bold text-paper"
              >
                {initial}
              </span>
            )}
            <Link
              href="/me/edit"
              aria-label={t("edit")}
              className="absolute -bottom-1 -end-1 grid h-8 w-8 place-items-center rounded-full bg-ink text-paper shadow-[0_4px_12px_rgba(33,39,57,0.2)] hover:bg-ink/90"
            >
              <Pencil size={13} aria-hidden="true" />
            </Link>
          </div>

          <div className="min-w-0 flex-1 pt-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
              {t("joined", { date: joinedFmt })}
            </p>
            <h1 className="mt-1 text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">
              {t.rich("header", {
                accent: (chunks) => (
                  <span className="font-light text-primary">{chunks}</span>
                ),
              })}
            </h1>
            <p className="mt-1.5 truncate font-mono text-[11.5px] text-ink/55">
              {email}
            </p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-6 grid grid-cols-3 gap-1.5">
          <Stat label={t("stats.pieces")} value={piecesCount} />
          <Stat label={t("stats.favorites")} value={favoritesCount} />
          <Stat label={t("stats.wears")} value={wearsTotal} />
        </div>

        {/* My stuff */}
        <p className="mt-7 px-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
          {t("myStuff")}
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          <Row
            href="/closet"
            Icon={LayoutGrid}
            label={t("myCloset")}
            sub={t("myClosetSub", { n: piecesCount })}
            accent="primary"
          />
          <Row
            href="/favorites"
            Icon={Bookmark}
            label={t("myFavorites")}
            sub={t("myFavoritesSub", { n: favoritesCount })}
            accent="secondary"
          />

          {dbUser.role === "SELLER" && (
            <Row
              href="/dashboard"
              Icon={Store}
              label={t("sellerDashboard")}
              sub={t("sellerDashboardSub")}
              accent="ink"
            />
          )}
          {dbUser.role === "ADMIN" && (
            <Row
              href="/admin/sellers"
              Icon={ShieldCheck}
              label={t("adminPanel")}
              sub={t("adminPanelSub")}
              accent="ink"
            />
          )}
          {dbUser.role === "BUYER" && (
            <Row
              href="/dashboard/onboarding"
              Icon={Package}
              label={t("openShop")}
              sub={t("openShopSub")}
              accent="ink"
            />
          )}
        </ul>

        {/* Sign out */}
        <div className="mt-6">
          <SignOutRow />
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-paper px-3 py-3 text-center">
      <p className="text-[22px] font-bold leading-none tracking-[-0.02em] text-ink">
        {value}
      </p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink/55">
        {label}
      </p>
    </div>
  );
}

const ACCENT_BG: Record<"primary" | "secondary" | "ink", string> = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/15 text-secondary",
  ink: "bg-ink/8 text-ink",
};

function Row({
  href,
  Icon,
  label,
  sub,
  accent,
}: {
  href:
    | "/closet"
    | "/favorites"
    | "/dashboard"
    | "/admin/sellers"
    | "/dashboard/onboarding";
  Icon: typeof LayoutGrid;
  label: string;
  sub: string;
  accent: "primary" | "secondary" | "ink";
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-2xl bg-paper px-3.5 py-3 text-ink transition-colors hover:bg-paper/80"
      >
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${ACCENT_BG[accent]}`}
        >
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
            {label}
          </p>
          <p className="mt-0.5 font-mono text-[10.5px] text-ink/55">{sub}</p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-ink/40" aria-hidden="true" />
      </Link>
    </li>
  );
}
