// Static decorative chat preview for the marketing landing page.
// Content is intentionally English-only as a brand demo — when the real
// stylist ships in Phase 2, this component can be swapped for a live
// streaming embed.
import type { ReactNode } from "react";

export function StylistChatPreview() {
  return (
    <div className="relative rounded-3xl bg-paper p-6 shadow-[0_2px_60px_rgba(33,39,57,0.08)] sm:p-8">
      <div className="mb-6 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/55">
          Live Demo · Stylist Conversation
        </span>
      </div>

      <div className="space-y-3">
        <Bubble side="bot">
          Welcome to Vesture. Tell me what you're looking for — a feeling, a fabric, an outfit.
        </Bubble>
        <Bubble side="user">Quiet dinner. Soft, warm, but not casual.</Bubble>
        <Bubble side="bot">Got it. A few directions I&apos;d lean into:</Bubble>

        <div className="flex flex-wrap gap-2 pt-1">
          <Chip>quiet luxury</Chip>
          <Chip>tonal layering</Chip>
          <Chip>soft tailoring</Chip>
        </div>

        <Bubble side="bot">Pulled from 6 sellers near Tehran.</Bubble>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ProductTile
          color="#5fa2b3"
          tag="ON BODY"
          title="Cropped boucle jacket"
          price="6,400,000 IRR"
        />
        <ProductTile
          color="#2c3149"
          tag="EDITORIAL"
          title="Pleated silk midi skirt"
          price="3,900,000 IRR"
        />
        <ProductTile
          color="#e89bb8"
          tag="PRODUCT"
          title="Persian cotton tee — clay"
          price="780,000 IRR"
        />
        <ProductTile
          color="#1b2336"
          title="Quilted carry tote"
          price="2,650,000 IRR"
        />
      </div>
    </div>
  );
}

function Bubble({
  side,
  children,
}: {
  side: "bot" | "user";
  children: ReactNode;
}) {
  if (side === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-sm text-paper">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-mist px-4 py-2.5 text-sm text-ink/85">
      {children}
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
      {children}
    </span>
  );
}

function ProductTile({
  color,
  tag,
  title,
  price,
}: {
  color: string;
  tag?: string;
  title: string;
  price: string;
}) {
  // Diagonal stripe overlay mimics the design's textured tiles.
  const stripes =
    "repeating-linear-gradient(-45deg, transparent 0 6px, rgba(255,255,255,0.08) 6px 7px)";
  return (
    <div>
      <div
        className="relative aspect-square overflow-hidden rounded-lg"
        style={{ background: color, backgroundImage: stripes }}
      >
        {tag && (
          <span className="absolute bottom-1.5 start-1.5 text-[8px] font-bold uppercase tracking-[0.15em] text-paper/80">
            {tag}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs font-medium leading-tight text-ink">{title}</p>
      <p className="mt-0.5 text-[10px] text-ink/50">{price}</p>
    </div>
  );
}
