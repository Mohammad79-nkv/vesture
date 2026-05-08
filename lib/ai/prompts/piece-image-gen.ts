// Prompt for the image-to-image clean-product transform.
//
// We pass the user's uploaded photo + this text instruction to
// `google/gemini-2.5-flash-image-preview` ("Nano Banana") via
// OpenRouter. The model returns a freshly generated image; we
// upload it to Cloudinary and use the new publicId as the piece's
// primary thumbnail.
//
// Aesthetic reference: high-end e-commerce catalog photography
// (Adidas product pages, SSENSE, MR PORTER) — pure white seamless,
// the piece centered, soft natural drop shadow, even diffuse
// studio lighting, no props, no models, no environment.
//
// Framing hints are baked per category because the image gen
// fires in parallel with tag analysis, so we don't know the
// category at request time — we include guidance for every
// category and let the model match the right one from the photo.

export const PIECE_IMAGE_GEN_PROMPT = `Generate a high-end e-commerce catalog product photo of the item in this image. Match the visual language of premium retail sites (Adidas product pages, SSENSE, MR PORTER, Nike): pure white seamless background, soft natural drop shadow underneath the item, even diffuse studio lighting, the item centered with consistent margin, sharp focus, true-to-life color.

Hard rules:
- Pure white background (#FFFFFF). No gradient, no floor, no walls, no environment, no props.
- Subtle natural drop shadow directly beneath the item — soft and diffuse, not hard-edged.
- Even soft studio lighting. No harsh highlights or strong directional light.
- Preserve every visual detail of the original piece exactly: silhouette, color, fabric texture, stitching, hardware, logos, branding. Do not invent details that weren't in the source. Do not change the color even slightly.
- No models, hands, mannequins, hangers, or other supports unless the item visually requires one.
- No text overlay, watermark, size labels, or chrome.
- Output a square 1:1 image at the highest reasonable resolution for thumbnails.

Framing per category (pick what matches the photo):
- SHOES: pair shown together at a slight 3/4 angle, one shoe slightly behind the other, both pointing camera-right. Show side profile clearly.
- BAGS: 3/4 angle showing both the front face and the strap/handle. Place upright or as the piece naturally rests.
- TOPS / DRESSES / OUTERWEAR: ghost-mannequin / invisible-mannequin technique — the garment is photographed as if worn by an invisible person so it keeps its full 3D shape (sleeves filled, neckline open, bust/waist line natural) but no body, mannequin, hanger, model, or hands are visible anywhere. Front-facing, symmetric, fully in frame, including hem. Sleeve puffs, ruffles, and any structural details must be preserved with their natural dimensionality.
- BOTTOMS (pants / jeans / skirts): perfect flat-lay top-down. Waistband at the top of the frame, hem at the bottom, both legs parallel and fully extended (for trousers), full length visible from waist to hem. No bunching, no folds, no twisting — only the natural wash, fade, and texture of the fabric. The garment fills the frame top-to-bottom with consistent margins on the sides. Show pockets, fly, stitching, hardware (rivets, buttons) sharply.
- ACCESSORIES (scarves, belts, jewelry): centered, top-down or 3/4, whichever shows the form.

The output must look like a single product was photographed in a professional studio for a luxury retailer's website — no other interpretation.`;
