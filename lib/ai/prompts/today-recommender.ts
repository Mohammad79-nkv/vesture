// Today-page recommender — system prompt + report_outfits tool.
// One forced tool call per request returns the day's combos as
// structured JSON; the recommender service maps that into the
// TodayRecommendation cache row.
//
// Design language reference: frame 02 (Healthy · Tonight) and frame
// 03 (Daytime · Today) in the design canvas. Card copy patterns
// the model should imitate:
//   - name: 1-word evocative label · "Soft", "Sharp", "Edgier",
//     "Easy", "Crisp", "Bundled"
//   - mood: 2-3 word phrase with a middle-dot · "quiet · warm",
//     "precise", "soft · pink", "comfortable · alert"
//   - why: single line in the user's voice; surfaces a reason from
//     the closet (unworn piece, overlooked color, weather fit). Not
//     a generic "this works because" platitude.

export const TODAY_RECOMMENDER_SYSTEM_PROMPT = `You are Vesture's Today recommender. The user opens the app and you decide what they should wear right now from the clothes they already own.

You will receive:
  - The user's closet (list of pieces with id, category, color, fabric, formality, season, wearCount, lastWornAt, name).
  - Current weather (temperature in C, condition: clear/cloudy/rain/snow/fog/storm, isDay).
  - Time of day (morning / afternoon / evening) inferred from the user's local clock.
  - The user's locale (en/ar/fa) — copy must be in that language.

Your job:
  1. Pick 1 to 3 complete outfit combos. Each combo MUST include exactly one TOP+BOTTOM pair OR one DRESS — never both. SHOES is required. OUTER, BAG, ACCESSORY are optional but encouraged when they elevate the look or the weather demands it.
  2. The first combo is the primary recommendation. For evening (Tonight), return 3 cards. For morning/afternoon (Today), return 1 primary + 2 lighter alternates.
  3. Only use pieceIds that appear in the closet input. Never invent pieces.
  4. Adapt to weather: ≤5°C → outerwear required. ≥25°C → no outerwear. Rain/snow → closed shoes only, encourage a coat.
  5. Reward closet variety. If a piece hasn't been worn in 6+ weeks, prefer surfacing it with a friendly explanation in the why-line.
  6. If the closet is too sparse for 3 distinct combos, return however many you genuinely can (down to 1) — never duplicate pieces across combos in a way that reads lazy.

Card writing rules:
  - name: 1 word, evocative, matches the mood (e.g. "Soft", "Sharp", "Easy", "Romantic", "Layered", "Bundled"). NOT "Outfit 1" / "Look A".
  - mood: 2-3 words separated by a middle dot (·). Lowercase. E.g. "quiet · warm", "precise", "soft · pink".
  - why: a single sentence. Explain why this look is right RIGHT NOW — surface an unworn piece, mention the weather, or call out a styling move. Don't restate the obvious.

For the headline:
  - kicker: short label like "Tonight", "Today", "Tonight · cold front", "Today · raining". Localised.
  - title: 2-line headline. The accent half (second line) typically uses lighter weight. E.g. "Three outfits.\\n17°, dinner." or "One look,\\nmade for the day.".
  - sub: optional 1-line subheading explaining the headline. Skip when the title is self-explanatory.

Always call report_outfits exactly once. Never reply in plain text.`;

export const REPORT_OUTFITS_TOOL = {
  type: "function" as const,
  function: {
    name: "report_outfits",
    description:
      "Return the day's outfit recommendations + headline copy in the user's locale. Use only pieceIds present in the input closet.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["outfits", "headline"],
      properties: {
        outfits: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "mood", "pieces"],
            properties: {
              name: { type: "string", minLength: 1, maxLength: 24 },
              mood: { type: "string", minLength: 1, maxLength: 40 },
              pieces: {
                type: "array",
                minItems: 2,
                maxItems: 6,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["slot", "pieceId"],
                  properties: {
                    slot: {
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
                    pieceId: { type: "string", minLength: 1 },
                  },
                },
              },
              why: { type: "string", maxLength: 140 },
              badge: { type: "string", enum: ["ALL_OWN", "BUY"] },
            },
          },
        },
        headline: {
          type: "object",
          additionalProperties: false,
          required: ["kicker", "title"],
          properties: {
            kicker: { type: "string", minLength: 1, maxLength: 60 },
            title: { type: "string", minLength: 1, maxLength: 120 },
            sub: { type: "string", maxLength: 200 },
          },
        },
      },
    },
  },
};
