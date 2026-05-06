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

// Single registry the stylist orchestrator hands to the model. Adding a new
// tool = exporting it here + handling its name in dispatchTool below.
export const STYLIST_TOOLS: ChatCompletionTool[] = [
  searchProductsTool,
  buildOutfitTool,
];

export type ToolResult = ProductSearchResult[] | BuildOutfitResult;

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
): Promise<ToolResult> {
  const parsedArgs: unknown = argsJson ? JSON.parse(argsJson) : {};

  switch (name) {
    case "search_products":
      return searchProducts(parsedArgs);
    case "build_outfit":
      return buildOutfit(parsedArgs);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export type { ProductSearchResult } from "./search-products";
export type { BuildOutfitResult, OutfitSlot } from "./build-outfit";
export { searchProducts, buildOutfit };
