import {
  imageGenModel,
  openrouter,
  tokensUsed,
} from "@/lib/adapters/openrouter";
import {
  transformedUrl,
  uploadClosetImageFromDataUri,
} from "@/lib/adapters/cloudinary";
import { PIECE_IMAGE_GEN_PROMPT } from "@/lib/ai/prompts/piece-image-gen";

// Closet auto-tag follow-up · clean-product image generation.
//
// Pipeline:
//   1. Build the user's Cloudinary URL at width=720 (smaller image
//      = fewer model tokens, identical quality for catalog-style
//      output).
//   2. Send the URL + PIECE_IMAGE_GEN_PROMPT to the configured
//      image-gen model via OpenRouter (default Gemini 2.5 Flash
//      Image, "Nano Banana").
//   3. Pull the base64 image out of the response, upload to
//      Cloudinary under closet/{userId}/.
//   4. Return the new publicId/url for createPieceAction to store
//      in place of the original photo.
//
// Errors throw a typed PieceImageGenError so the route can decide
// whether to fall back to the original photo (graceful degradation
// is the v1 contract — see app/api/closet/analyze/route.ts).

export class PieceImageGenError extends Error {
  constructor(
    public code:
      | "MODEL_NO_IMAGE"
      | "MODEL_BAD_RESPONSE"
      | "MODEL_FAILED"
      | "UPLOAD_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "PieceImageGenError";
  }
}

// OpenRouter returns image gen results in the assistant message's
// `images` array. Each entry is { type: "image_url", image_url:
// { url: "data:image/png;base64,..." } }. The exact key name is
// stable across the Gemini integration; we narrow defensively.
type OpenRouterImagePart = {
  type?: string;
  image_url?: { url?: string } | string;
};

function extractDataUri(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const m = message as { images?: OpenRouterImagePart[] };
  const images = m.images;
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0];
  if (!first) return null;
  // image_url can be a string or a nested object — handle both.
  if (typeof first.image_url === "string") return first.image_url;
  if (
    first.image_url &&
    typeof first.image_url === "object" &&
    typeof first.image_url.url === "string"
  ) {
    return first.image_url.url;
  }
  return null;
}

export async function generateCleanProductImage(args: {
  userId: string;
  sourcePublicId: string;
}): Promise<{
  publicId: string;
  url: string;
  tokensUsed: number;
}> {
  // Smaller variant of the user's photo — Gemini doesn't need 4K
  // input to produce a clean 1024px output, and the smaller URL
  // means fewer image tokens on the prompt side.
  const sourceUrl = transformedUrl(args.sourcePublicId, 720);

  let completion;
  try {
    // OpenAI SDK types don't model OpenRouter's `modalities`
    // override (used to opt-in to image output on multimodal
    // models). We cast through `unknown` so TS doesn't reject
    // the extra field but the rest of the request is still
    // type-checked at the SDK boundary.
    const requestBody = {
      model: imageGenModel(),
      // Higher token cap because Gemini's image gen response
      // includes the base64 image inline; the default cap can
      // truncate long encodings.
      max_tokens: 4096,
      messages: [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: PIECE_IMAGE_GEN_PROMPT },
            {
              type: "image_url" as const,
              image_url: { url: sourceUrl },
            },
          ],
        },
      ],
      modalities: ["image", "text"],
      // Force a non-streaming response so we can pull `choices`
      // off the resolved completion.
      stream: false as const,
    };
    completion = await openrouter().chat.completions.create(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      requestBody as any,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "OpenRouter image-gen failed";
    throw new PieceImageGenError("MODEL_FAILED", message);
  }

  const message = completion.choices[0]?.message;
  const dataUri = extractDataUri(message);
  if (!dataUri) {
    throw new PieceImageGenError(
      "MODEL_NO_IMAGE",
      "Model response didn't include an image",
    );
  }

  let uploaded;
  try {
    uploaded = await uploadClosetImageFromDataUri({
      userId: args.userId,
      dataUri,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Cloudinary upload failed";
    throw new PieceImageGenError("UPLOAD_FAILED", message);
  }

  return {
    publicId: uploaded.publicId,
    url: uploaded.url,
    tokensUsed: tokensUsed(completion.usage ?? {}),
  };
}
