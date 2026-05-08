import type { ReactNode } from "react";

// Big editorial header: small uppercase mono kicker, then a 38px
// Manrope title with an accent on the second line. Frame 02 uses
// "Three outfits. / 17°, dinner." with the second line dimmed; frame
// 03 uses italic teal on the second line.
//
// We accept the title as ReactNode so the model-generated headline
// can split lines + apply local emphasis without us second-guessing
// the structure. Title strings from the recommender include a literal
// "\n" separator we split on at render time.
export function TodayHeader({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub?: string | null;
}) {
  // Split on the first newline so the recommender's "Three outfits.\n
  // 17°, dinner." renders as two lines with the accent class on line 2.
  const newlineIdx = title.indexOf("\n");
  const head = newlineIdx >= 0 ? title.slice(0, newlineIdx) : title;
  const tail = newlineIdx >= 0 ? title.slice(newlineIdx + 1) : null;

  return (
    <div className="px-5 pt-1">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
        {kicker}
      </p>
      <h1 className="mt-2 text-[34px] font-bold leading-[0.96] tracking-[-0.03em] text-ink sm:text-[38px]">
        {head}
        {tail ? (
          <>
            <br />
            <span className="text-ink/45">{tail}</span>
          </>
        ) : null}
      </h1>
      {sub ? (
        <p className="mt-2.5 max-w-[290px] text-[13px] leading-[1.45] text-ink/70">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

// Render the kicker + title for the dark / accent variants used by
// the cold / rain frames in 3E.3. We export the regular component
// today and add variants in that phase.
export function TodayHeaderInline({
  kicker,
  children,
  sub,
}: {
  kicker: string;
  children: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="px-5 pt-1">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
        {kicker}
      </p>
      <h1 className="mt-2 text-[34px] font-bold leading-[0.96] tracking-[-0.03em] text-ink sm:text-[38px]">
        {children}
      </h1>
      {sub ? (
        <p className="mt-2.5 max-w-[290px] text-[13px] leading-[1.45] text-ink/70">
          {sub}
        </p>
      ) : null}
    </div>
  );
}
