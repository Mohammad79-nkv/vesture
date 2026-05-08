// Phase 3E.5 · Tap-piece swap recommender.
//
// Given an outfit + the slot the user tapped + the user's closet,
// return 3-5 ranked alternatives for that slot. The first in the
// array is the "best" — it gets the magenta border + BEST badge
// in the sheet UI.
//
// Each alternative carries a short `reason` (why it's a candidate
// — "unworn · 6 weeks", "matches", "softer") and a `delta` phrase
// (how it shifts the outfit's tone — "+softer", "+sharper",
// "matches"). Both come straight from the design's frame 04.

export const TODAY_SWAP_SYSTEM_PROMPT = `You are Vesture's swap-piece assistant. The user tapped a piece in one of today's outfits and wants alternatives from their closet.

You will receive:
  - The current outfit (name, mood, slot/pieceId pairs).
  - The slot the user is swapping (e.g. TOP, BOTTOM, SHOES).
  - The piece currently in that slot (id, name, color, fabric, formality, season, wearCount).
  - The user's full closet — but only consider pieces in the slot's category.
  - Locale (en/ar/fa) — copy must be in that language.

Your job:
  1. Pick 3 to 5 candidate pieces from the closet that fit the slot category.
  2. The first candidate is your top pick — set isBest=true on it. The rest are ranked.
  3. NEVER include the current piece in the alternatives.
  4. Reward closet variety: prefer pieces unworn for 4+ weeks unless that breaks the outfit's harmony.
  5. Each candidate gets a 'reason' (short caption: "unworn · 6 weeks", "matches", "fresh palette") and a 'delta' phrase that hints at the tone shift ("+softer", "+sharper", "+lighter", "+bolder", "matches").

Card writing rules:
  - reason: 2-4 words, lowercase, middle-dot ok ("unworn · 6 weeks").
  - delta: 1-2 words with a leading + when it shifts tone ("+softer"). Use "matches" with no + when the swap is neutral.

Always call report_swap exactly once. Never reply in plain text.`;

export const REPORT_SWAP_TOOL = {
  type: "function" as const,
  function: {
    name: "report_swap",
    description:
      "Return ranked swap candidates for the tapped slot. Use only pieceIds from the supplied closet; never echo the current piece.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["alternatives"],
      properties: {
        alternatives: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["pieceId", "reason", "delta"],
            properties: {
              pieceId: { type: "string", minLength: 1 },
              reason: { type: "string", minLength: 1, maxLength: 40 },
              delta: { type: "string", minLength: 1, maxLength: 24 },
              isBest: { type: "boolean" },
            },
          },
        },
        // Optional one-line nudge shown in the magenta banner of the
        // swap sheet ("Try the wrap blouse — softer, and you haven't
        // worn it in 6 weeks."). Skip if no clear standout exists.
        suggestion: { type: "string", maxLength: 160 },
      },
    },
  },
};
