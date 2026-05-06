import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, Sparkles } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireAdmin } from "@/lib/auth";
import { getUserDetailAdmin } from "@/lib/services/admin";
import { transformedUrl } from "@/lib/adapters/cloudinary";
import { DashboardCard } from "@/components/seller/DashboardCard";
import { STYLE_TAGS, type StyleTag } from "@/lib/domain/styleTags";

// Admin-only deep view of a single user. Surfaces the data scattered across
// the regular admin pages (taste tags, every closet photo they've uploaded,
// counts, store info if seller) on one page so an admin can audit the
// account end-to-end without clicking through three other surfaces.
export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireAdmin();

  const detail = await getUserDetailAdmin(id);
  if (!detail) notFound();
  const { user, favoritesCount, productsCount } = detail;

  const t = await getTranslations("admin.userDetail");
  const tStyles = await getTranslations("onboardingTaste.styles");
  const tFilters = await getTranslations("closet.filters");
  const tPiece = await getTranslations("closetPiece");

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  // Filter persisted style tags to only those the picker still recognizes —
  // safe-rendering guard if the STYLE_TAGS list ever shrinks.
  const recognizedTags = (user.styleTags as StyleTag[]).filter((tag) =>
    (STYLE_TAGS as readonly string[]).includes(tag),
  );

  const initial =
    user.email.trim().charAt(0).toUpperCase() || "U";

  return (
    <main className="mx-auto w-full max-w-[1376px] px-6 py-8 sm:px-8 sm:py-10">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 self-start py-2 text-[12px] font-medium tracking-[-0.01em] text-ink/70 hover:text-ink"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        {t("back")}
      </Link>

      {/* Header */}
      <header className="mt-4 flex flex-wrap items-start gap-5">
        <span
          aria-hidden="true"
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary text-[24px] font-bold text-paper"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {user.role} · {t("joined")} {dateFmt.format(user.createdAt)}
          </p>
          <h1 className="mt-1 break-all text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[36px]">
            {user.email}
          </h1>
          <p className="mt-1.5 font-mono text-[11px] text-muted">
            {user.onboardedAt
              ? `${t("onboarded")} · ${dateFmt.format(user.onboardedAt)}`
              : t("notOnboarded")}
          </p>
        </div>
      </header>

      {/* Stats */}
      <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label={t("stats.pieces")} value={user.closetPieces.length} />
        <Stat label={t("stats.favorites")} value={favoritesCount} />
        {user.sellerProfile && (
          <Stat label={t("stats.products")} value={productsCount} />
        )}
      </div>

      {/* Taste tags */}
      <section className="mt-8">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
          {t("tasteTitle")}
        </p>
        <DashboardCard>
          {recognizedTags.length === 0 ? (
            <p className="py-4 text-[13px] text-ink/55">{t("tasteEmpty")}</p>
          ) : (
            <div className="flex flex-wrap gap-2 py-2">
              {recognizedTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1.5 text-[12.5px] font-semibold tracking-[-0.01em] text-primary"
                >
                  <Sparkles size={11} aria-hidden="true" />
                  {tStyles(tag)}
                </span>
              ))}
            </div>
          )}
        </DashboardCard>
      </section>

      {/* Seller store summary */}
      {user.sellerProfile && (
        <section className="mt-8">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
            {t("store")}
          </p>
          <DashboardCard>
            <dl className="grid grid-cols-2 gap-y-3 sm:grid-cols-4">
              <Field label={t("store")} value={user.sellerProfile.storeNameEn} />
              <Field label={t("storeStatus")} value={user.sellerProfile.status} />
              <Field label={t("country")} value={user.sellerProfile.countryCode} />
              <Field
                label={t("currency")}
                value={user.sellerProfile.defaultCurrency}
              />
            </dl>
          </DashboardCard>
        </section>
      )}

      {/* Closet photos */}
      <section className="mt-8">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
          {t("closetTitle")} · {user.closetPieces.length}
        </p>
        {user.closetPieces.length === 0 ? (
          <DashboardCard>
            <p className="py-4 text-[13px] text-ink/55">{t("closetEmpty")}</p>
          </DashboardCard>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {user.closetPieces.map((piece) => (
              <li key={piece.id}>
                <article
                  className="relative aspect-square overflow-hidden rounded-2xl"
                  style={{ background: piece.swatchHex ?? "#C9CDD6" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={transformedUrl(piece.publicId, 400)}
                    alt={piece.name ?? tFilters(piece.category)}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute start-2 top-2 rounded-md bg-paper/90 px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.08em] text-ink backdrop-blur">
                    {tFilters(piece.category)}
                  </span>
                  {piece.status !== "IN_CLOSET" && (
                    <span className="absolute end-2 top-2 rounded-md bg-ink/70 px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.08em] text-paper backdrop-blur">
                      {tPiece(`status.${piece.status}`)}
                    </span>
                  )}
                </article>
                <div className="mt-1.5 px-0.5">
                  <p className="truncate text-[12px] leading-tight text-ink">
                    {piece.name ?? "—"}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[9.5px] text-ink/55">
                    {[piece.fabric, piece.color].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-paper px-4 py-3 text-center">
      <p className="text-[24px] font-bold leading-none tracking-[-0.02em] text-ink">
        {value}
      </p>
      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
        {label}
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-[13px] font-medium text-ink">{value ?? "—"}</dd>
    </div>
  );
}
