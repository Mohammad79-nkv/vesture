import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";
import {
  openrouter,
  stylistModel,
  cached,
  dailyTokenBudgetPerUser,
} from "@/lib/adapters/openrouter";
import { STYLIST_TOOLS, dispatchTool } from "@/lib/ai/tools";
import { STYLIST_SYSTEM_PROMPT } from "@/lib/ai/prompts/stylist";
import {
  ANON_STYLIST_TURN_LIMIT,
  newAnonState,
  readAnonCookie,
  setAnonCookieHeader,
} from "@/lib/auth-anon";
import {
  findOrCreateSession,
  attachAnonSession,
  appendMessage,
  tokensUsedTodayForUser,
} from "@/lib/services/stylist";
import { getOrCreateDbUser } from "@/lib/auth";
import type {
  ProductSearchResult,
  BuildOutfitResult,
} from "@/lib/ai/tools";

// /api/stylist — streaming SSE endpoint that drives the multi-step agent
// loop. Per turn:
//   1. Append the user's new message to the rolling conversation
//   2. Stream a model response (text deltas + tool-call chunks)
//   3. If the model requested tools, execute them, feed the results back
//      into the conversation, and call the model again
//   4. Repeat until the model returns plain text (finish_reason: "stop")
//
// Cap the loop at MAX_STEPS so a misbehaving model can't burn the budget
// indefinitely. Five is plenty for a brief (search → build_outfit →
// summarise); raise if real conversations need more.
//
// Auth: signed-in only for now. The 3-turn anonymous wall lands in
// milestone #7. Rate-limiting + token budget are #9 and #10.

export const runtime = "nodejs";

const MAX_STEPS = 5;
const MAX_USER_MSG_CHARS = 4_000;
const MAX_TURNS_IN_HISTORY = 40;

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(MAX_USER_MSG_CHARS),
      }),
    )
    .min(1)
    .max(MAX_TURNS_IN_HISTORY),
  // The locale the user is browsing in — ar / en / fa. Used to anchor the
  // model's reply language for short / ambiguous first messages where the
  // user's text alone doesn't disambiguate. Optional; defaults to "en".
  locale: z.enum(["en", "ar", "fa"]).optional(),
});

// Maps the locale code to a natural-language name the model knows. The
// system hint reads better as "Arabic" than "ar".
const LOCALE_NAME: Record<"en" | "ar" | "fa", string> = {
  en: "English",
  ar: "Arabic",
  fa: "Persian",
};

type StreamEvent =
  | { type: "text"; value: string }
  | { type: "tool_call"; name: string }
  | { type: "tool_result"; name: string; data: unknown }
  | { type: "tool_error"; name: string; message: string }
  | { type: "done"; usage?: { promptTokens?: number; completionTokens?: number } }
  | { type: "error"; message: string };

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.message);
  }

  // Anonymous trial gate. Signed-in users skip this entirely.
  // Anonymous users get a signed cookie with a count + sessionId; once the
  // count hits ANON_STYLIST_TURN_LIMIT we stream a single sign_in_required
  // event and close, without making the LLM call.
  let anonCookieHeader: string | null = null;
  let anonSessionIdForPersistence: string | null = null;
  if (!userId) {
    const existing = readAnonCookie(req) ?? newAnonState();
    if (existing.count >= ANON_STYLIST_TURN_LIMIT) {
      return signInRequiredResponse();
    }
    anonSessionIdForPersistence = existing.sessionId;
    // Increment optimistically so a refresh-loop attack still consumes
    // the budget. The cookie is set on the streaming response below.
    anonCookieHeader = setAnonCookieHeader({
      count: existing.count + 1,
      sessionId: existing.sessionId,
    });
  }

  // Resolve the DB session row before we kick off streaming. For an
  // authenticated user with a still-valid anon cookie (e.g. they were
  // anonymous-trying then signed in mid-conversation), attach the prior
  // session to their account so the conversation continues.
  const dbUser = userId ? await getOrCreateDbUser() : null;
  if (dbUser) {
    const lingeringAnon = readAnonCookie(req);
    if (lingeringAnon) {
      await attachAnonSession({
        anonCookieSessionId: lingeringAnon.sessionId,
        userId: dbUser.id,
      });
    }
  }
  const session = await findOrCreateSession({
    userId: dbUser?.id ?? null,
    anonCookieSessionId: anonSessionIdForPersistence,
  });

  // Daily token budget — authenticated users only. Anonymous traffic is
  // already bounded by the 3-turn cookie wall, so layering a token cap on
  // top would be belt + suspenders without adding much. Bucket resets at
  // 00:00 UTC so users get a predictable refresh ("come back tomorrow").
  if (dbUser) {
    const used = await tokensUsedTodayForUser(dbUser.id);
    const limit = dailyTokenBudgetPerUser();
    if (used >= limit) {
      return budgetExceededResponse({ used, limit });
    }
  }

  // Persist the new user message immediately — even if the stream errors
  // mid-flight we'll still have the prompt for debugging / future fine-tune.
  const lastUserTurn = parsed.data.messages[parsed.data.messages.length - 1];
  if (lastUserTurn?.role === "user") {
    await appendMessage({
      sessionId: session.id,
      role: "USER",
      content: lastUserTurn.content,
    });
  }

  // The static brand prompt is wrapped in cached() so OpenRouter forwards
  // the cache_control marker to Anthropic. Cast: OpenAI's TS types don't
  // model the cache_control field; the SDK passes unknown fields through
  // to the wire untouched.
  //
  // The locale hint is a SECOND system message, deliberately NOT cached
  // (it varies per user) — small enough that the missed-cache cost is
  // negligible. Two system messages concatenate naturally on Anthropic's
  // side, so the model reads them as one set of rules.
  const locale = parsed.data.locale ?? "en";
  const localeHint = `User is browsing Vesture in ${LOCALE_NAME[locale]}. Default your replies to ${LOCALE_NAME[locale]} unless the user clearly switches language mid-conversation.`;

  const initialMessages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: cached(STYLIST_SYSTEM_PROMPT) as any,
    },
    {
      role: "system",
      content: localeHint,
    },
    ...parsed.data.messages,
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      const messages: ChatCompletionMessageParam[] = [...initialMessages];
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;

      // Aggregators rolled into the assistant ChatMessage row in the
      // finally block — final visible text, every tool call we issued
      // across the loop, and every product surfaced via tool results.
      let aggregatedAssistantText = "";
      const aggregatedToolCalls: Array<{
        id: string;
        name: string;
        arguments: string;
      }> = [];
      const aggregatedProductIds: string[] = [];

      const collectProductIds = (toolName: string, data: unknown) => {
        if (toolName === "search_products" && Array.isArray(data)) {
          for (const p of data as ProductSearchResult[]) {
            if (p?.id) aggregatedProductIds.push(p.id);
          }
        } else if (
          toolName === "build_outfit" &&
          data &&
          typeof data === "object"
        ) {
          const outfit = data as BuildOutfitResult;
          if (outfit.seed?.id) aggregatedProductIds.push(outfit.seed.id);
          for (const slot of outfit.slots ?? []) {
            if (slot.product?.id) aggregatedProductIds.push(slot.product.id);
          }
        }
      };

      try {
        for (let step = 0; step < MAX_STEPS; step++) {
          const completion = await openrouter().chat.completions.create({
            model: stylistModel(),
            messages,
            tools: STYLIST_TOOLS,
            stream: true,
            stream_options: { include_usage: true },
          });

          let assistantText = "";
          // Tool calls arrive in piecewise deltas; we accumulate by index
          // because OpenAI / OpenRouter chunk arguments across many events.
          const toolBuf: Array<{ id: string; name: string; args: string }> = [];
          let finishReason: string | null = null;

          for await (const chunk of completion) {
            // Final usage chunk arrives without a `choices[0]` — capture it
            // separately so we can report cost after the loop.
            if (chunk.usage) {
              totalPromptTokens += chunk.usage.prompt_tokens ?? 0;
              totalCompletionTokens += chunk.usage.completion_tokens ?? 0;
            }
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
              assistantText += delta.content;
              send({ type: "text", value: delta.content });
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index;
                const slot = (toolBuf[idx] ??= { id: "", name: "", args: "" });
                if (tc.id) slot.id = tc.id;
                if (tc.function?.name) slot.name += tc.function.name;
                if (tc.function?.arguments) slot.args += tc.function.arguments;
              }
            }
            if (chunk.choices?.[0]?.finish_reason) {
              finishReason = chunk.choices[0].finish_reason;
            }
          }

          // Roll any visible text from this step into the aggregated turn —
          // the assistant ChatMessage row stores the full visible reply
          // even when it's spread across multiple loop iterations.
          aggregatedAssistantText += assistantText;

          // Plain text reply → conversation is done.
          if (toolBuf.length === 0 || finishReason === "stop") {
            break;
          }

          // Append the assistant turn (including the requested tool calls) so
          // the next iteration's context has the full record.
          const toolCalls: ChatCompletionMessageToolCall[] = toolBuf.map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.args },
          }));
          messages.push({
            role: "assistant",
            content: assistantText || null,
            tool_calls: toolCalls,
          });
          for (const tc of toolBuf) {
            aggregatedToolCalls.push({
              id: tc.id,
              name: tc.name,
              arguments: tc.args,
            });
          }

          // Execute each tool. Errors become tool_result messages with an
          // `error` field — the model recovers gracefully ("nothing fit, want
          // to bump the budget?") instead of dying mid-turn.
          for (const tc of toolBuf) {
            send({ type: "tool_call", name: tc.name });
            try {
              const result = await dispatchTool(tc.name, tc.args);
              collectProductIds(tc.name, result);
              send({ type: "tool_result", name: tc.name, data: result });
              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify(result),
              });
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              send({ type: "tool_error", name: tc.name, message });
              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify({ error: message }),
              });
            }
          }
        }

        send({
          type: "done",
          usage: {
            promptTokens: totalPromptTokens,
            completionTokens: totalCompletionTokens,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({ type: "error", message });
      } finally {
        // Persist the assistant turn even on partial / errored streams so
        // we keep a record for debugging and analytics. Skips the write
        // when there's nothing meaningful (no text and no products) to
        // avoid empty rows after early-aborts.
        if (
          aggregatedAssistantText.length > 0 ||
          aggregatedProductIds.length > 0
        ) {
          try {
            await appendMessage({
              sessionId: session.id,
              role: "ASSISTANT",
              content: aggregatedAssistantText,
              toolCalls:
                aggregatedToolCalls.length > 0 ? aggregatedToolCalls : undefined,
              productIds: aggregatedProductIds,
              // Total tokens for this turn = prompt + completion summed
              // across every loop iteration. Used by tokensUsedTodayForUser
              // on the next request's pre-flight budget check.
              tokensUsed: totalPromptTokens + totalCompletionTokens,
            });
          } catch {
            // Swallow — persistence failures must not crash the stream
            // close. The user already got their reply; we just lose the
            // history row, which surfaces in logs (TODO: Sentry).
          }
        }
        controller.close();
      }
    },
  });

  const responseHeaders: Record<string, string> = {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    // X-Accel-Buffering disables nginx-side buffering when deployed behind
    // a proxy; harmless on Vercel.
    "x-accel-buffering": "no",
    connection: "keep-alive",
  };
  if (anonCookieHeader) {
    responseHeaders["set-cookie"] = anonCookieHeader;
  }
  return new Response(stream, { headers: responseHeaders });
}

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Tiny SSE response that emits one sign_in_required event and closes —
// the chat client listens for this and pops the modal wall. Returning a
// 200 SSE rather than 401 JSON keeps the client's stream-parser code
// uniform regardless of why the model didn't run.
function signInRequiredResponse(): Response {
  return singleEventResponse({ type: "sign_in_required" });
}

// Same idea for the daily token budget — close out cleanly with one
// event the UI can react to.
function budgetExceededResponse(args: {
  used: number;
  limit: number;
}): Response {
  return singleEventResponse({
    type: "budget_exceeded",
    used: args.used,
    limit: args.limit,
  });
}

function singleEventResponse(event: object): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}
