import type { ChatCompletionTool } from "openai/resources/chat/completions";
import {
  searchProducts,
  searchProductsTool,
  type ProductSearchResult,
} from "./search-products";
import {
  buildOutfit,
  buildOutfitTool,
  type BuildOutfitResult,
} from "./build-outfit";
import {
  searchMyCloset,
  searchMyClosetTool,
  type ClosetPieceResult,
} from "./search-my-closet";

// Tool list given to the model on each call. search_my_closet is only
// included when there's a signed-in user — anonymous visitors have no
// closet, so the tool would always return empty and Claude would waste
// tokens deciding whether to invoke it.
export function stylistTools(ctx: { userId: string | null }): ChatCompletionTool[] {
  const tools: ChatCompletionTool[] = [searchProductsTool, buildOutfitTool];
  if (ctx.userId) tools.push(searchMyClosetTool);
  return tools;
}

export type ToolResult =
  | ProductSearchResult[]
  | BuildOutfitResult
  | ClosetPieceResult[];

// Context every handler can reach. The userId is the DB User.id (NOT the
// Clerk id) so handlers don't have to round-trip through clerk → user.
export type ToolContext = { userId: string | null };

// Routes a model-issued tool call to its handler. The model returns the
// args as a JSON-encoded string per OpenAI's tool-calling contract; we
// parse, then each handler validates with its own Zod schema.
//
// Errors are intentionally let through — the orchestrator will surface them
// to the model as a tool_result with an error field, and Claude is good at
// recovering ("I couldn't find anything in that range, want to bump the
// budget?") without us needing to do anything special on our side.
export async function dispatchTool(
  name: string,
  argsJson: string,
  ctx: ToolContext,
): Promise<ToolResult> {
  const parsedArgs: unknown = argsJson ? JSON.parse(argsJson) : {};

  switch (name) {
    case "search_products":
      return searchProducts(parsedArgs);
    case "build_outfit":
      return buildOutfit(parsedArgs);
    case "search_my_closet":
      return searchMyCloset(parsedArgs, ctx);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export type { ProductSearchResult } from "./search-products";
export type { BuildOutfitResult, OutfitSlot } from "./build-outfit";
export type { ClosetPieceResult } from "./search-my-closet";
export { searchProducts, buildOutfit, searchMyCloset };
