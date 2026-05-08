// Prompt for the image-to-image clean-product transform.
//
// We pass the user's uploaded photo + this text instruction to
// `google/gemini-2.5-flash-image-preview` ("Nano Banana") via
// OpenRouter. The model returns a freshly generated image; we
// upload it to Cloudinary and use the new publicId as the piece's
// primary thumbnail.
//
// Prompt rules:
//   - "Generate" not "edit" — this is image-to-image, not edit-in-place
//   - Lock the piece's identity: shape, color, fabric, branding details
//     should match the input
//   - Strip the environment: white/light-neutral background, no clutter,
//     even soft lighting
//   - Compose for thumbnails: piece centered, full silhouette in frame,
//     no awkward crops

export const PIECE_IMAGE_GEN_PROMPT = `Generate a clean catalog-style product photo of the clothing item or accessory in this image.

Rules:
- Light neutral background (#F2F4F7 or off-white). No room, no floor, no other objects.
- The piece is centered, fully in frame, with a small consistent margin.
- Even soft lighting. Subtle ground shadow only.
- Preserve every visual detail of the original piece exactly: silhouette, color, fabric texture, stitching, hardware, logos. Do not invent details that weren't in the source.
- Photograph the piece head-on (or 3/4 view if more flattering for the silhouette). No models or hands.
- Output a square 1:1 image suitable as a closet thumbnail.

Do not include any text overlay, watermark, or branding chrome.`;
