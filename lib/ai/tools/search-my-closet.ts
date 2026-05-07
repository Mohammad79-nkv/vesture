import { z } from "zod";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/adapters/prisma";
import { transformedUrl } from "@/lib/adapters/cloudinary";

// `search_my_closet` — reads pieces from the signed-in user's own closet
// so the stylist can mix owned + new instead of always recommending fresh
// purchases. Anonymous users get an empty result; the dispatcher won't
// even include the tool in the model's tool list when there's no userId,
// so Claude doesn't waste tokens deciding whether to call.
//
// Sorted by wear count desc — heavy-rotation pieces are likely the user's
// favorites and the most useful anchors. The `category` filter lets the
// model narrow when it knows what kind of slot it's filling.

export const searchMyClosetArgs = z.object({
  category: z
    .enum(["TOPS", "BOTTOMS", "DRESSES", "OUTERWEAR", "SHOES", "BAGS", "ACCESSORIES"])
    .optional(),
  limit: z.number().int().min(1).max(20).default(10),
});

export type SearchMyClosetArgs = z.infer<typeof searchMyClosetArgs>;

export type ClosetPieceResult = {
  id: string;
  name: string | null;
  category: string;
  color: string | null;
  fabric: string | null;
  formality: string | null;
  season: string | null;
  imageUrl: string | null;
  wearCount: number;
};

export const searchMyClosetTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_my_closet",
    description:
      "Read pieces from the signed-in user's own closet. Call this BEFORE search_products when the brief allows mixing owned + new — most users prefer to wear what they already have. Empty result = the user has no pieces in that category yet.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        category: {
          type: "string",
          enum: ["TOPS", "BOTTOMS", "DRESSES", "OUTERWEAR", "SHOES", "BAGS", "ACCESSORIES"],
          description: "Narrow to one slot when filling a specific gap.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 20,
          default: 10,
          description: "How many pieces to return. Default 10 is plenty.",
        },
      },
    },
  },
};

export async function searchMyCloset(
  rawArgs: unknown,
  ctx: { userId: string | null },
): Promise<ClosetPieceResult[]> {
  // Anonymous users have no closet — return empty so Claude can move on
  // without crashing. The dispatcher should already be omitting this
  // tool in the anon case, but defending here is cheap.
  if (!ctx.userId) return [];

  const args = searchMyClosetArgs.parse(rawArgs);

  const where: Prisma.ClosetPieceWhereInput = {
    userId: ctx.userId,
    status: "IN_CLOSET",
    ...(args.category && { category: args.category }),
  };

  const rows = await prisma.closetPiece.findMany({
    where,
    orderBy: [{ wearCount: "desc" }, { createdAt: "desc" }],
    take: args.limit,
  });

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    color: p.color,
    fabric: p.fabric,
    formality: p.formality,
    season: p.season,
    imageUrl: p.publicId ? transformedUrl(p.publicId, 400) : null,
    wearCount: p.wearCount,
  }));
}
