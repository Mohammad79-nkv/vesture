import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";
import { openrouter, stylistModel, cached } from "@/lib/adapters/openrouter";
import { STYLIST_TOOLS, dispatchTool } from "@/lib/ai/tools";
import { STYLIST_SYSTEM_PROMPT } from "@/lib/ai/prompts/stylist";

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
});

type StreamEvent =
  | { type: "text"; value: string }
  | { type: "tool_call"; name: string }
  | { type: "tool_result"; name: string; data: unknown }
  | { type: "tool_error"; name: string; message: string }
  | { type: "done"; usage?: { promptTokens?: number; completionTokens?: number } }
  | { type: "error"; message: string };

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return jsonError(401, "Unauthorized");
  }

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

  // System prompt is wrapped in cached() so OpenRouter forwards the
  // cache_control marker to Anthropic. Cast: OpenAI's TS types don't model
  // the cache_control field; the SDK passes unknown fields through to the
  // wire untouched.
  const initialMessages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: cached(STYLIST_SYSTEM_PROMPT) as any,
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

          // Execute each tool. Errors become tool_result messages with an
          // `error` field — the model recovers gracefully ("nothing fit, want
          // to bump the budget?") instead of dying mid-turn.
          for (const tc of toolBuf) {
            send({ type: "tool_call", name: tc.name });
            try {
              const result = await dispatchTool(tc.name, tc.args);
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
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      // X-Accel-Buffering disables nginx-side buffering when deployed behind
      // a proxy; harmless on Vercel.
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
