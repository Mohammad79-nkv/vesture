// Outfit scorer system prompt — narrower scope than the chat stylist
// (lib/ai/prompts/stylist.ts). Cached on every request via cached() so
// the second scoring of any session pays only the delta input cost.
//
// Output is enforced via a forced tool call (`report_score`) rather than
// response_format json_schema — Anthropic-via-OpenRouter handles forced
// tools more reliably than json_schema, and the tool definition doubles
// as the schema documentation for the model.

export const OUTFIT_SCORER_SYSTEM_PROMPT = `You are the Vesture outfit scorer. Given a composed outfit (a list of garment pieces from the user's own closet) plus a snapshot of the user's full closet for context, you score the outfit on harmony / fit / occasion and return concrete, opinionated feedback.

# Output rules
- Always finish by calling the report_score tool. Never respond with plain text.
- composite: 0-100, weighted average leaning on harmony (50%) + fit (30%) + occasion (20%). Never round to a multiple of 10 — give a real number like 78.
- subScores.harmony: color, fabric, and style coherence (0-100)
- subScores.fit: how the garment categories work together (silhouette, layering logic) (0-100)
- subScores.occasion: how well the look fits the stated occasion (0-100). If no occasion is given, score it as 75 — neutral.
- label: derived from composite — STRONG ≥85, GOOD 70-84, OK 55-69, WEAK <55
- verdict.headline: 2-5 words, evocative, ends with a period. e.g. "Quietly strong." or "Off in places."
- verdict.body: ≤ 200 characters. Specific. Name at least one piece by its name or category.
- whatWorking: 2-4 entries. Each is { tone: "color" | "fabric" | "occasion" | "fit", body: short specific observation }. Don't be vague — "color" entries should name the actual colors.
- whatToTry: 1-3 entries. Two kinds:
  - { kind: "swap", pieceId, targetCategory, suggestion, harmonyDelta, source: "closet" } — pieceId MUST come from the user's closet snapshot. harmonyDelta is the projected new harmony score (e.g. 91 if current is 84).
  - { kind: "shop", targetCategory, suggestion, deltaHint } — for gaps the closet can't fill. Describe the missing piece concretely; don't name a brand.

# Voice
Editorial, opinionated, concrete. The user is paying for taste, not encouragement.
- BAN: "Great outfit!", "Nice combo!", "Awesome choice", "I love how…", emoji.
- Prefer: "The camel + burgundy is a classic move." "The sneakers fight the silhouette." "Cream cashmere wants a softer sole."
- Reply in the user's locale (en / ar / fa) for verdict + whatWorking + whatToTry text.

# Hard constraints
- Never invent a piece. Every "swap" pieceId must exist in the closet snapshot.
- Never recommend the user buy something they already own (check the closet snapshot).
- Don't repeat the outfit's piece names back to the user — they wrote them.`;

// Forced tool definition handed to OpenRouter alongside the prompt. The
// model returns its score by calling this tool; we read result.tool_calls[0]
// to get the structured payload. Same shape as the OutfitScore type the
// route persists to SavedOutfit's nullable AI columns.
export const REPORT_SCORE_TOOL = {
  type: "function" as const,
  function: {
    name: "report_score",
    description:
      "Return the structured outfit score. Call this exactly once per request and return nothing else.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: [
        "composite",
        "label",
        "verdict",
        "subScores",
        "whatWorking",
        "whatToTry",
      ],
      properties: {
        composite: {
          type: "integer",
          minimum: 0,
          maximum: 100,
          description: "Composite 0-100. Don't round to multiples of 10.",
        },
        label: {
          type: "string",
          enum: ["STRONG", "GOOD", "OK", "WEAK"],
          description: "Derived from composite — STRONG ≥85, GOOD 70-84, OK 55-69, WEAK <55.",
        },
        verdict: {
          type: "object",
          additionalProperties: false,
          required: ["headline", "body"],
          properties: {
            headline: {
              type: "string",
              maxLength: 40,
              description: "2-5 evocative words ending with a period.",
            },
            body: {
              type: "string",
              maxLength: 200,
              description: "≤ 200 chars. Names at least one piece. In the user's locale.",
            },
          },
        },
        subScores: {
          type: "object",
          additionalProperties: false,
          required: ["harmony", "fit", "occasion"],
          properties: {
            harmony: { type: "integer", minimum: 0, maximum: 100 },
            fit: { type: "integer", minimum: 0, maximum: 100 },
            occasion: { type: "integer", minimum: 0, maximum: 100 },
          },
        },
        whatWorking: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["tone", "body"],
            properties: {
              tone: {
                type: "string",
                enum: ["color", "fabric", "occasion", "fit"],
              },
              body: { type: "string", maxLength: 140 },
            },
          },
        },
        whatToTry: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            // OneOf would be cleaner but Anthropic via OpenRouter has been
            // inconsistent with discriminated unions. Single permissive
            // object with `kind` discriminator + optional fields validates
            // server-side via Zod.
            type: "object",
            additionalProperties: false,
            required: ["kind", "targetCategory", "suggestion"],
            properties: {
              kind: { type: "string", enum: ["swap", "shop"] },
              pieceId: {
                type: "string",
                description: "Required when kind=swap. Must exist in the closet snapshot.",
              },
              targetCategory: {
                type: "string",
                enum: [
                  "TOP",
                  "BOTTOM",
                  "DRESS",
                  "OUTER",
                  "SHOES",
                  "BAG",
                  "ACCESSORY",
                ],
              },
              suggestion: { type: "string", maxLength: 160 },
              harmonyDelta: {
                type: "integer",
                minimum: 0,
                maximum: 100,
                description: "Required when kind=swap. Projected new harmony score.",
              },
              deltaHint: {
                type: "string",
                description: "Required when kind=shop. Short rationale (e.g. \"would raise fit +9\").",
                maxLength: 80,
              },
              source: {
                type: "string",
                enum: ["closet"],
                description: "Required when kind=swap.",
              },
            },
          },
        },
      },
    },
  },
} as const;
