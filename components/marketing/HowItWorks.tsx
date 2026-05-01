import { getTranslations } from "next-intl/server";

export async function HowItWorks() {
  const t = await getTranslations("howItWorks");

  const steps = [
    { n: "01", title: t("step1Title"), body: t("step1Body") },
    { n: "02", title: t("step2Title"), body: t("step2Body") },
    { n: "03", title: t("step3Title"), body: t("step3Body") },
    { n: "04", title: t("step4Title"), body: t("step4Body") },
  ];

  return (
    <section className="border-y border-ink/5 bg-paper py-20">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-6 lg:grid-cols-[280px_1fr] lg:items-center">
        <div className="flex flex-col items-start gap-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-secondary">
            {t("eyebrow")}
          </p>
          <span className="font-display text-7xl italic text-primary md:text-8xl">
            {t("display")}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {steps.map((s) => (
            <article key={s.n} className="rounded-2xl bg-mist p-6">
              <p className="font-mono text-xs tracking-widest text-ink/55">{s.n}</p>
              <h3 className="mt-3 text-xl font-bold text-ink">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/65">{s.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
