import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth";
import { listSellersByStatus, approveSeller, rejectSeller } from "@/lib/services/seller";
import { revalidatePath } from "next/cache";

export default async function AdminSellersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const user = await requireUser();
  if (user.role !== "ADMIN") redirect(`/${locale}`);

  const [pending, approved, rejected] = await Promise.all([
    listSellersByStatus("PENDING"),
    listSellersByStatus("APPROVED"),
    listSellersByStatus("REJECTED"),
  ]);

  async function approve(formData: FormData) {
    "use server";
    const me = await requireUser();
    if (me.role !== "ADMIN") return;
    const sellerId = String(formData.get("sellerId"));
    await approveSeller({ adminId: me.id, sellerId });
    revalidatePath(`/${locale}/admin/sellers`);
  }

  async function reject(formData: FormData) {
    "use server";
    const me = await requireUser();
    if (me.role !== "ADMIN") return;
    const sellerId = String(formData.get("sellerId"));
    const reason = String(formData.get("reason") ?? "Not approved");
    await rejectSeller({ adminId: me.id, sellerId, reason });
    revalidatePath(`/${locale}/admin/sellers`);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-light">Sellers</h1>

      <Section title={`Pending (${pending.length})`}>
        {pending.length === 0 ? (
          <p className="text-sm text-ink/60">Nothing in the queue.</p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {pending.map((s) => (
              <li key={s.id} className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{s.storeNameEn}</p>
                    <p className="text-xs text-ink/60">
                      {s.user.email} · {s.countryCode} · {s.defaultCurrency}
                    </p>
                    {s.bioEn && <p className="mt-1 text-sm text-ink/80">{s.bioEn}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <form action={approve}>
                      <input type="hidden" name="sellerId" value={s.id} />
                      <button className="bg-ink px-4 py-1.5 text-xs uppercase tracking-wider text-paper">
                        Approve
                      </button>
                    </form>
                    <form action={reject} className="flex gap-1">
                      <input type="hidden" name="sellerId" value={s.id} />
                      <input
                        name="reason"
                        placeholder="Reason"
                        className="border border-ink/20 px-2 py-1 text-xs"
                      />
                      <button className="border border-ink px-4 py-1.5 text-xs uppercase tracking-wider">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Approved (${approved.length})`}>
        <ul className="divide-y divide-ink/10">
          {approved.map((s) => (
            <li key={s.id} className="py-2 text-sm">
              {s.storeNameEn} · <span className="text-ink/60">{s.user.email}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Rejected (${rejected.length})`}>
        <ul className="divide-y divide-ink/10">
          {rejected.map((s) => (
            <li key={s.id} className="py-2 text-sm">
              {s.storeNameEn} ·{" "}
              <span className="text-ink/60">{s.rejectionReason}</span>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-xs uppercase tracking-wider text-ink/60">{title}</h2>
      {children}
    </section>
  );
}
