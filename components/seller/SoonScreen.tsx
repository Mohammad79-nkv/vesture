// Reusable "coming soon" body for seller-side pages that don't ship until
// a later phase (Instagram bot, Inbox, Insights).
export function SoonScreen({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-[1376px] flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
        {eyebrow}
      </p>
      <h1 className="text-[44px] font-bold leading-[1] tracking-[-0.03em] text-ink">
        {title}
      </h1>
      <p className="mt-4 max-w-md text-base text-ink/65">{body}</p>
    </main>
  );
}
