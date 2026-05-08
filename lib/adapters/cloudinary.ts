import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const PRODUCTS_FOLDER = process.env.CLOUDINARY_UPLOAD_FOLDER ?? "vesture/products";
const CLOSET_FOLDER = "vesture/closet";

// Generate a signature the browser uses to upload directly to Cloudinary.
// The image bytes never touch our server, so this scales without us paying
// per-byte egress. Folder structure: products/<sellerId>/, closet/<userId>/.
export function signUpload(
  params: { kind: "product"; sellerId: string } | { kind: "closet"; userId: string },
): {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
} {
  const timestamp = Math.round(Date.now() / 1000);
  const folder =
    params.kind === "product"
      ? `${PRODUCTS_FOLDER}/${params.sellerId}`
      : `${CLOSET_FOLDER}/${params.userId}`;

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET as string,
  );

  return {
    signature,
    timestamp,
    folder,
    apiKey: process.env.CLOUDINARY_API_KEY as string,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME as string,
  };
}

export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { invalidate: true });
}

// Server-side upload from a base64 data URI (e.g. "data:image/png;
// base64,..."). Used by the AI image-gen pipeline (Phase 3D follow-up)
// where the model returns the generated image in-band rather than as
// a URL we can stream from. Foldered under closet/{userId}/ so
// cleanup-by-user mirrors the signed-upload path. Returns the standard
// publicId/url pair the rest of the codebase already consumes.
export async function uploadClosetImageFromDataUri(args: {
  userId: string;
  dataUri: string;
}): Promise<{ publicId: string; url: string }> {
  const result = await cloudinary.uploader.upload(args.dataUri, {
    folder: `${CLOSET_FOLDER}/${args.userId}`,
    resource_type: "image",
  });
  return { publicId: result.public_id, url: result.secure_url };
}

// Build a transformed URL for thumbnails / hero images. Cloudinary serves
// AVIF/WebP automatically with f_auto.
export function transformedUrl(publicId: string, width: number): string {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      { width, crop: "fill", gravity: "auto" },
      { fetch_format: "auto", quality: "auto" },
    ],
  });
}
