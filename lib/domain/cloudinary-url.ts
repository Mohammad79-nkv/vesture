// Client-safe Cloudinary URL builder. The full `cloudinary` SDK can't be
// imported into a client component (it requires `fs` for file uploads),
// but we just need to produce display URLs. Cloudinary's URL contract is
// stable and string-template-able:
//
//   https://res.cloudinary.com/<cloudName>/image/upload/<transformations>/<publicId>
//
// NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is exposed to the browser bundle, so
// this works server- and client-side. Server components can still use
// `transformedUrl()` from lib/adapters/cloudinary for parity with the
// SDK; client components must use this.

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

export function cloudinaryUrl(publicId: string, width: number): string {
  if (!CLOUD || !publicId) return "";
  // c_fill + g_auto: square-style crop with content-aware center; f_auto +
  // q_auto: best modern format + quality for the user's network conditions.
  return `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,f_auto,g_auto,q_auto,w_${width}/${publicId}`;
}
