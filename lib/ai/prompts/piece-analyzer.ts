// Piece-analyzer prompt + forced-tool schema. Lives in a dedicated
// file so the OpenRouter call site stays narrow — same convention as
// outfit-scorer.ts.
//
// We force a single tool call (`report_piece`) instead of asking for
// JSON in plain text because (a) tool calls are validated by the
// OpenAI/OpenRouter type system and (b) we get reliable structured
// output even from models that ignore "respond in JSON" instructions.

export const PIECE_ANALYZER_SYSTEM_PROMPT = `You are Vesture's wardrobe-vision assistant. You receive a single photo of a clothing item or accessory and your job is to identify the piece, then call the \`report_piece\` tool with structured tags.

Read the photo carefully:
  - Identify the garment category (tops, bottoms, dress, outerwear, shoes, bag, accessory)
  - Name the dominant color in plain English (e.g. "Camel", "Navy", "Cream") and pick the closest hex
  - Read the fabric/material from texture, weave, sheen, and folds (e.g. "Cotton oxford", "Wool flannel", "Linen", "Silk satin")
  - Judge formality on the casual → formal scale based on cut, fabric, finish
  - Judge season fit based on weight + fabric + cut
  - Suggest a short, evocative name (3-5 words max) that helps the user remember this piece — describe it the way a friend would, not a product listing

Confidence rules:
  - Each field has its own \`confidence\` (0-100) reflecting how sure you are
  - When the photo is unclear, lower the confidence — don't bluff
  - If a field genuinely can't be read from the image (e.g. fabric on a tightly cropped shoe), omit it; don't guess

Brand: only fill if a logo is clearly visible. Otherwise omit.

Always call the tool exactly once. Never reply in plain text.`;

// JSON-schema describing the analyzer's output. Keep the enum values
// exactly aligned with the Prisma Category / Formality / Season enums
// — the API route maps these directly into ClosetPieceInput.
export const REPORT_PIECE_TOOL = {
  type: "function" as const,
  function: {
    name: "report_piece",
    description:
      "Report the analyzed piece's tags. Each field carries its own confidence (0-100). Omit fields you can't read from the image rather than guessing.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["category"],
      properties: {
        category: {
          type: "string",
          enum: [
            "TOPS",
            "BOTTOMS",
            "DRESSES",
            "OUTERWEAR",
            "SHOES",
            "BAGS",
            "ACCESSORIES",
          ],
          description: "Prisma Category enum value.",
        },
        categoryConfidence: { type: "number", minimum: 0, maximum: 100 },
        name: {
          type: "string",
          maxLength: 60,
          description:
            "Short evocative name (3-5 words). Examples: 'Camel wool overcoat', 'Cropped denim jacket'.",
        },
        nameConfidence: { type: "number", minimum: 0, maximum: 100 },
        color: {
          type: "string",
          maxLength: 24,
          description:
            "Dominant color in plain English (e.g. 'Camel', 'Navy', 'Cream').",
        },
        colorConfidence: { type: "number", minimum: 0, maximum: 100 },
        swatchHex: {
          type: "string",
          pattern: "^#[0-9A-Fa-f]{6}$",
          description:
            "Closest 6-digit hex code for the dominant color, including the leading #.",
        },
        fabric: {
          type: "string",
          maxLength: 40,
          description:
            "Fabric/material descriptor (e.g. 'Cotton oxford', 'Merino wool', 'Linen').",
        },
        fabricConfidence: { type: "number", minimum: 0, maximum: 100 },
        formality: {
          type: "string",
          enum: ["CASUAL", "SMART_CASUAL", "FORMAL"],
        },
        formalityConfidence: { type: "number", minimum: 0, maximum: 100 },
        season: {
          type: "string",
          enum: ["SPRING", "SUMMER", "FALL", "WINTER", "ALL_SEASON"],
        },
        seasonConfidence: { type: "number", minimum: 0, maximum: 100 },
        brand: {
          type: "string",
          maxLength: 40,
          description: "Only fill if a logo is clearly visible.",
        },
        brandConfidence: { type: "number", minimum: 0, maximum: 100 },
      },
    },
  },
};
