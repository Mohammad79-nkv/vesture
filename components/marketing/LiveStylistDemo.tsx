import { getTranslations } from "next-intl/server";

// Live AI stylist demo card from desktop-wardrobe.jsx. Static decorative
// content — when Phase 2 ships the real stylist, this card swaps in a
// streaming version. The savings strip and OWNED tags are what sells the
// "mix owned + new" story.
const stripes =
  "repeating-linear-gradient(135deg, rgba(33,39,57,0.05) 0 1px, transparent 1px 9px)";

export async function LiveStylistDemo() {
  const t = await getTranslations("welcome");

  return (
    <div className="relative max-h-[620px] rounded-3xl bg-[#FFFDFA] p-5 text-ink shadow-[0_32px_80px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.08)] sm:p-[22px]">
      <div className="mb-3.5 flex items-center gap-2">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          {t("demoEyebrow")}
        </span>
      </div>

      <Bubble side="ai">{t("demoAi1")}</Bubble>
      <Bubble side="user">{t("demoUser")}</Bubble>
      <Bubble side="ai">{t("demoAi2")}</Bubble>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <Chip>{t("demoChip1")}</Chip>
        <Chip>{t("demoChip2")}</Chip>
        <Chip>{t("demoChip3")}</Chip>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <DemoTile color="#DCEDF1" label={t("demoTile1")} tag={t("demoTagOwned")} tagTone="owned" />
        <DemoTile color="#C9CDD6" label={t("demoTile2")} tag={t("demoTagOwned")} tagTone="owned" />
        <DemoTile color="#5E6478" label={t("demoTile3")} tag="+$84" tagTone="buy" />
      </div>

      <div className="mt-2.5 flex items-center justify-between rounded-xl bg-mist px-3 py-2.5">
        <p className="text-[11.5px] text-ink-soft">
          {t.rich("demoSavings", {
            amt: (chunks) => (
              <strong className="font-bold text-primary">{chunks}</strong>
            ),
          })}
        </p>
        <span className="font-mono text-[9px] tracking-[0.06em] text-secondary">
          {t("demoPercentLess")}
        </span>
      </div>
    </div>
  );
}

function Bubble({ side, children }: { side: "ai" | "user"; children: React.ReactNode }) {
  if (side === "user") {
    return (
      <div className="mb-2.5 flex justify-end">
        <div className="max-w-[82%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2 text-[12.5px] leading-snug text-paper">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="mb-2.5">
      <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-mist px-3.5 py-2 text-[12.5px] leading-snug text-ink">
        {children}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
      {children}
    </span>
  );
}

function DemoTile({
  color,
  label,
  tag,
  tagTone,
}: {
  color: string;
  label: string;
  tag: string;
  tagTone: "owned" | "buy";
}) {
  const tagBg = tagTone === "owned" ? "#DCEDF1" : "#FCE3EE";
  const tagFg = tagTone === "owned" ? "#256776" : "#A50253";
  return (
    <div className="relative">
      <div
        className="relative h-[100px] overflow-hidden rounded-[10px]"
        style={{ background: color, backgroundImage: stripes }}
      >
        <span className="absolute bottom-1.5 start-1.5 text-[8px] font-medium uppercase tracking-[0.04em] text-paper/85">
          {label}
        </span>
      </div>
      <span
        className="absolute start-1.5 top-1.5 rounded-[4px] px-1.5 py-0.5 font-mono text-[9px] tracking-[0.06em]"
        style={{ background: tagBg, color: tagFg }}
      >
        {tag}
      </span>
    </div>
  );
}
