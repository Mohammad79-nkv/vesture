// Client-side image compression — runs in the browser before we
// hand the bytes to Cloudinary's signed upload endpoint. Phone
// photos are routinely 4-12 MB; downscaling to ≤2000px on the
// longest side at JPEG quality 0.85 typically lands at 200-500 KB
// with no visible quality drop for clothing thumbnails. The
// downstream Gemini image-gen + tag analyzer also benefit (smaller
// input = faster tokenisation + cheaper).
//
// Strategy:
//   - Skip if the file is already small (<500 KB) or non-image.
//   - Use the Canvas API (no extra deps). HEIC/HEIF from iPhones
//     can't be drawn to canvas in most browsers — we catch that
//     and fall back to the original file so the upload still
//     works, just unoptimised.
//   - Output JPEG. Compatible everywhere; alpha-channel formats
//     (PNG/WebP source) lose transparency, which is fine for
//     garment photography (no transparent inputs).

const MAX_DIMENSION = 2000;
const QUALITY = 0.85;
const SKIP_BELOW_BYTES = 500 * 1024;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size < SKIP_BELOW_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    // createImageBitmap is the fastest decode path and avoids
    // the URL.createObjectURL → <img> dance. It throws on HEIC
    // in browsers that don't support it natively (Chrome on
    // most platforms, all Firefox).
    bitmap = await createImageBitmap(file);
  } catch {
    // Fall back to original file — we'd rather upload an
    // unoptimised photo than block the user.
    return file;
  }

  // Compute target dimensions while preserving aspect ratio.
  // If the photo is already within the budget we skip the
  // canvas pass and just compress quality (often still saves
  // 30-50% off a phone photo).
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
  const targetW = Math.round(bitmap.width * scale);
  const targetH = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }

  // Drop alpha to white — clothing photos never use transparency
  // and JPEG output forces it anyway. Doing it explicitly avoids
  // some browsers leaving black bands on transparent inputs.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) return file;

  // If compression somehow grew the file (rare; happens on tiny
  // photos with very flat color) keep the original.
  if (blob.size >= file.size) return file;

  // Replace the extension with .jpg so the Cloudinary upload
  // doesn't mismatch its content-type sniff.
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
