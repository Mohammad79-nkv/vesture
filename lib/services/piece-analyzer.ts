import { z } from "zod";
import { openrouter, tokensUsed, visionModel } from "@/lib/adapters/openrouter";
import { transformedUrl } from "@/lib/adapters/cloudinary";
import {
  PIECE_ANALYZER_SYSTEM_PROMPT,
  REPORT_PIECE_TOOL,
} from "@/lib/ai/prompts/piece-analyzer";

// Structured-output shape the analyzer returns. We mirror the
// Prisma enums one-to-one (Category / Formality / Season) so the
// API route can map straight into ClosetPieceInput. Confidence is a
// per-field 0-100 — used only for the UI's detection rows.
export const analyzedPieceSchema = z.object({
  category: z.enum([
    "TOPS",
    "BOTTOMS",
    "DRESSES",
    "OUTERWEAR",
    "SHOES",
    "BAGS",
    "ACCESSORIES",
  ]),
  categoryConfidence: z.number().min(0).max(100).optional(),
  name: z.string().min(1).max(60).optional(),
  nameConfidence: z.number().min(0).max(100).optional(),
  color: z.string().min(1).max(24).optional(),
  colorConfidence: z.number().min(0).max(100).optional(),
  swatchHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  fabric: z.string().min(1).max(40).optional(),
  fabricConfidence: z.number().min(0).max(100).optional(),
  formality: z.enum(["CASUAL", "SMART_CASUAL", "FORMAL"]).optional(),
  formalityConfidence: z.number().min(0).max(100).optional(),
  season: z
    .enum(["SPRING", "SUMMER", "FALL", "WINTER", "ALL_SEASON"])
    .optional(),
  seasonConfidence: z.number().min(0).max(100).optional(),
  brand: z.string().min(1).max(40).optional(),
  brandConfidence: z.number().min(0).max(100).optional(),
});

export type AnalyzedPiece = z.infer<typeof analyzedPieceSchema>;

// Typed error so the API route can map analyzer failures to the
// right HTTP status (404 for missing image, 502 for model failure,
// 400 for bad model output, etc).
export class PieceAnalyzerError extends Error {
  constructor(
    public code:
      | "MODEL_NO_TOOL_CALL"
      | "MODEL_BAD_JSON"
      | "MODEL_BAD_SHAPE"
      | "MODEL_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "PieceAnalyzerError";
  }
}

// Send the photo to the vision model with a forced report_piece tool
// call. Returns the parsed tags + token usage so the route can fold
// it into the same daily-budget bookkeeping the stylist + scoring
// surfaces use.
//
// We pass a Cloudinary-transformed URL (max width 720) instead of the
// raw asset — vision models don't need a 4k photo to call out a piece
// of clothing, and a smaller image cuts both the OpenRouter image-
// detail cost and our latency.
export async function analyzePiece(args: {
  publicId: string;
}): Promise<{ piece: AnalyzedPiece; tokensUsed: number }> {
  const imageUrl = transformedUrl(args.publicId, 720);

  let completion;
  try {
    completion = await openrouter().chat.completions.create({
      model: visionModel(),
      messages: [
        {
          role: "system",
          content: PIECE_ANALYZER_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this clothing item and call report_piece with the tags.",
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      tools: [REPORT_PIECE_TOOL],
      tool_choice: {
        type: "function",
        function: { name: "report_piece" },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenRouter request failed";
    throw new PieceAnalyzerError("MODEL_FAILED", message);
  }

  const message = completion.choices[0]?.message;
  const toolCall = message?.tool_calls?.[0];
  if (
    !toolCall ||
    toolCall.type !== "function" ||
    toolCall.function.name !== "report_piece"
  ) {
    throw new PieceAnalyzerError(
      "MODEL_NO_TOOL_CALL",
      "Model didn't call report_piece",
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new PieceAnalyzerError(
      "MODEL_BAD_JSON",
      "Model returned malformed tool arguments",
    );
  }

  const parsed = analyzedPieceSchema.safeParse(raw);
  if (!parsed.success) {
    throw new PieceAnalyzerError(
      "MODEL_BAD_SHAPE",
      `Model output failed validation: ${parsed.error.message.slice(0, 200)}`,
    );
  }

  return {
    piece: parsed.data,
    tokensUsed: tokensUsed(completion.usage ?? {}),
  };
}
