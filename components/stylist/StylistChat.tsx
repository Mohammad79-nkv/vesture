"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { ProductCardCarousel } from "./ProductCardCarousel";
import type { ProductSearchResult, BuildOutfitResult } from "@/lib/ai/tools";

// Visual chat surface for /stylist. Streams from POST /api/stylist (SSE),
// renders user/assistant bubbles, transient "Searching catalog…" pills
// while tools run, and inline horizontal scrolls of product cards
// underneath assistant turns when tool_result events arrive.
//
// State model:
//   - `messages` is the canonical conversation we send back to the API on
//     each turn (just user + assistant text content — tool calls live
//     server-side in /api/stylist's loop, not in client state)
//   - `streamingAssistant` is the in-flight assistant turn: text + the
//     product-card sets accumulated from tool_result events as they stream
//   - `toolCalls` lists currently-pending tool calls so the UI can render
//     a loading indicator until the matching tool_result arrives
//
// Once the SSE stream emits `done`, streamingAssistant is committed into
// messages and reset. New turn starts fresh.

type ChatRole = "user" | "assistant";

type ProductCardSet = {
  toolName: string;
  products: ProductSearchResult[];
};

type StoredMessage = {
  id: string;
  role: ChatRole;
  content: string;
  cardSets: ProductCardSet[];
};

type StreamEvent =
  | { type: "text"; value: string }
  | { type: "tool_call"; name: string }
  | { type: "tool_result"; name: string; data: unknown }
  | { type: "tool_error"; name: string; message: string }
  | { type: "sign_in_required" }
  | { type: "budget_exceeded"; used: number; limit: number }
  | { type: "rate_limited"; resetAt: number }
  | { type: "done"; usage?: { promptTokens?: number; completionTokens?: number } }
  | { type: "error"; message: string };

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Normalises a tool_result payload into ProductSearchResult[] regardless of
// whether the tool was search_products (already an array) or build_outfit
// (a struct with seed + slots). Lets the UI treat them uniformly.
function flattenProducts(toolName: string, data: unknown): ProductSearchResult[] {
  if (toolName === "search_products" && Array.isArray(data)) {
    return data as ProductSearchResult[];
  }
  if (toolName === "build_outfit" && data && typeof data === "object") {
    const outfit = data as BuildOutfitResult;
    const all: ProductSearchResult[] = [outfit.seed];
    for (const slot of outfit.slots) {
      if (slot.product) all.push(slot.product);
    }
    return all;
  }
  return [];
}

export function StylistChat({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("stylist.chat");
  const locale = useLocale();
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingCards, setStreamingCards] = useState<ProductCardSet[]>([]);
  const [pendingTools, setPendingTools] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Wall raised when /api/stylist returns the sign_in_required event for
  // an anonymous visitor who's used their 3 trial turns.
  const [wallOpen, setWallOpen] = useState(false);
  // Different wall for the per-user daily token budget. Same modal
  // pattern; different copy + CTA (no point sending an authed user back
  // to /sign-in).
  const [budgetWallOpen, setBudgetWallOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the conversation pinned to the bottom as new content streams in.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streamingText, streamingCards.length, pendingTools.length]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    setError(null);
    setDraft("");
    setStreamingText("");
    setStreamingCards([]);
    setPendingTools([]);

    const newUser: StoredMessage = {
      id: newId(),
      role: "user",
      content: trimmed,
      cardSets: [],
    };
    const next = [...messages, newUser];
    setMessages(next);
    setStreaming(true);

    try {
      const res = await fetch("/api/stylist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          locale,
        }),
      });

      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `HTTP ${res.status}`);
      }

      // SSE parser: split incoming bytes into "data: …\n\n" blocks. Track
      // the last partial event in `buffer` so we don't drop a chunk that
      // gets cut across a network frame.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      const cards: ProductCardSet[] = [];

      readLoop: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          for (const line of block.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            let event: StreamEvent;
            try {
              event = JSON.parse(line.slice(6)) as StreamEvent;
            } catch {
              continue;
            }

            switch (event.type) {
              case "text":
                assistantText += event.value;
                setStreamingText(assistantText);
                break;
              case "tool_call":
                setPendingTools((p) => [...p, event.name]);
                break;
              case "tool_result": {
                const products = flattenProducts(event.name, event.data);
                if (products.length > 0) {
                  cards.push({ toolName: event.name, products });
                  setStreamingCards([...cards]);
                }
                setPendingTools((p) => p.filter((n) => n !== event.name));
                break;
              }
              case "tool_error":
                setPendingTools((p) => p.filter((n) => n !== event.name));
                break;
              case "sign_in_required":
                // Roll back the user message we optimistically appended so
                // the prompt isn't sitting unanswered behind the wall.
                setMessages((m) => m.filter((msg) => msg.id !== newUser.id));
                setWallOpen(true);
                break readLoop;
              case "budget_exceeded":
                setMessages((m) => m.filter((msg) => msg.id !== newUser.id));
                setBudgetWallOpen(true);
                break readLoop;
              case "rate_limited":
                // Short-lived condition — surface as an inline error toast
                // and roll back the user message so they can retry once
                // the window resets. No modal: would feel heavier than the
                // problem it's flagging.
                setMessages((m) => m.filter((msg) => msg.id !== newUser.id));
                setError(t("rateLimitedBody"));
                break readLoop;
              case "error":
                setError(event.message || t("errorGeneric"));
                break readLoop;
              case "done":
                break readLoop;
            }
          }
        }
      }

      // Commit the in-flight turn into history.
      if (assistantText || cards.length > 0) {
        setMessages((m) => [
          ...m,
          {
            id: newId(),
            role: "assistant",
            content: assistantText,
            cardSets: cards,
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setStreaming(false);
      setStreamingText("");
      setStreamingCards([]);
      setPendingTools([]);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(draft);
  }

  const conversationEmpty = messages.length === 0 && !streaming;

  return (
    <div className="flex h-[100dvh] flex-col bg-mist text-ink">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 px-5 pt-3 pb-2">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 place-items-center rounded-full bg-primary text-paper"
        >
          <Sparkles size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">
            {t("header")}
          </p>
        </div>
      </header>

      {/* Scrolling message area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-6 pt-2">
        {conversationEmpty ? (
          <EmptyState onPick={(text) => void sendMessage(text)} />
        ) : (
          <ul className="mx-auto flex w-full max-w-[640px] flex-col gap-3">
            {messages.map((m) => (
              <li key={m.id}>
                <Bubble role={m.role} content={m.content} />
                {m.cardSets.length > 0 && (
                  <div className="mt-2 space-y-3">
                    {m.cardSets.map((set, i) => (
                      <ProductCardCarousel key={i} products={set.products} />
                    ))}
                  </div>
                )}
              </li>
            ))}

            {/* In-flight assistant turn */}
            {streaming && (
              <li>
                {streamingText && <Bubble role="assistant" content={streamingText} />}
                {streamingCards.length > 0 && (
                  <div className="mt-2 space-y-3">
                    {streamingCards.map((set, i) => (
                      <ProductCardCarousel key={i} products={set.products} />
                    ))}
                  </div>
                )}
                {pendingTools.length > 0 && (
                  <ToolPill
                    label={
                      pendingTools[0] === "build_outfit"
                        ? t("buildingOutfit")
                        : t("searching")
                    }
                  />
                )}
              </li>
            )}
          </ul>
        )}

        {error && (
          <p className="mx-auto mt-4 max-w-[640px] text-center text-[13px] text-red-600">
            {error}
          </p>
        )}
      </div>

      {/* Sticky input */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-ink/[0.06] bg-mist px-4 py-3"
      >
        <div className="mx-auto flex w-full max-w-[640px] items-end gap-2 rounded-3xl bg-paper p-2 shadow-[inset_0_0_0_1px_rgba(33,39,57,0.08)] focus-within:shadow-[inset_0_0_0_1.5px_rgba(205,2,104,0.6)]">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(draft);
              }
            }}
            placeholder={t("placeholder")}
            rows={1}
            disabled={streaming}
            maxLength={4000}
            className="flex-1 resize-none bg-transparent px-3 py-2 text-[14px] leading-[1.4] text-ink placeholder:text-ink/40 focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={streaming || draft.trim().length === 0}
            aria-label={t("send")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-paper transition-colors hover:bg-ink/90 disabled:opacity-40"
          >
            {streaming ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <ArrowUp size={16} strokeWidth={2.4} aria-hidden="true" />
            )}
          </button>
        </div>
      </form>

      {wallOpen && !signedIn && <SignInWallModal />}
      {budgetWallOpen && <BudgetWallModal />}
    </div>
  );
}

function BudgetWallModal() {
  const t = useTranslations("stylist.chat");
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-wall-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-4 pb-6 pt-20 backdrop-blur-sm sm:items-center sm:pb-0"
    >
      <div className="w-full max-w-[420px] rounded-3xl bg-paper p-6 shadow-[0_24px_60px_rgba(33,39,57,0.18)]">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 place-items-center rounded-full bg-primary text-paper"
          >
            <Sparkles size={16} aria-hidden="true" />
          </span>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">
            {t("header")}
          </p>
        </div>
        <h2
          id="budget-wall-title"
          className="mt-4 text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink"
        >
          {t("budgetTitle")}
        </h2>
        <p className="mt-2 text-[13.5px] leading-[1.5] text-ink/65">
          {t("budgetBody")}
        </p>
        <Link
          href="/products"
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[12px] font-medium uppercase tracking-[0.06em] text-paper hover:bg-ink/90"
        >
          {t("budgetButton")}
        </Link>
      </div>
    </div>
  );
}

function SignInWallModal() {
  const t = useTranslations("stylist.chat");
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-in-wall-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-4 pb-6 pt-20 backdrop-blur-sm sm:items-center sm:pb-0"
    >
      <div className="w-full max-w-[420px] rounded-3xl bg-paper p-6 shadow-[0_24px_60px_rgba(33,39,57,0.18)]">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 place-items-center rounded-full bg-primary text-paper"
          >
            <Sparkles size={16} aria-hidden="true" />
          </span>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">
            {t("header")}
          </p>
        </div>
        <h2
          id="sign-in-wall-title"
          className="mt-4 text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink"
        >
          {t("signInRequired")}
        </h2>
        <p className="mt-2 text-[13.5px] leading-[1.5] text-ink/65">
          {t("signInBody")}
        </p>
        <Link
          href="/sign-in"
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[12px] font-medium uppercase tracking-[0.06em] text-paper hover:bg-ink/90"
        >
          {t("signInButton")}
        </Link>
      </div>
    </div>
  );
}

function Bubble({ role, content }: { role: ChatRole; content: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[14px] leading-snug text-paper">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-paper px-4 py-2.5 text-[14px] leading-snug text-ink shadow-[0_1px_2px_rgba(33,39,57,0.04)]">
      {content || <span className="text-ink/30">…</span>}
    </div>
  );
}

function ToolPill({ label }: { label: string }) {
  return (
    <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink/55 shadow-[0_1px_2px_rgba(33,39,57,0.04)]">
      <Loader2 size={11} className="animate-spin text-primary" aria-hidden="true" />
      {label}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const t = useTranslations("stylist.chat");
  const suggestions = [t("suggestion1"), t("suggestion2"), t("suggestion3")];
  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col items-center pt-12 text-center">
      <span
        aria-hidden="true"
        className="grid h-12 w-12 place-items-center rounded-full bg-primary text-paper shadow-[0_8px_24px_rgba(205,2,104,0.4)]"
      >
        <Sparkles size={20} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-[22px] font-bold tracking-[-0.02em] text-ink">
        {t("emptyTitle")}
      </h2>
      <p className="mt-2 max-w-[360px] text-[13.5px] leading-[1.5] text-ink/65">
        {t("emptyBody")}
      </p>

      <div className="mt-5 flex w-full flex-col gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-2xl bg-paper px-4 py-3 text-start text-[13.5px] text-ink shadow-[inset_0_0_0_1px_rgba(33,39,57,0.06)] hover:shadow-[inset_0_0_0_1px_rgba(33,39,57,0.18)]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

