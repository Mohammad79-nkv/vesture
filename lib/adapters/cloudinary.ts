import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const UPLOAD_FOLDER = process.env.CLOUDINARY_UPLOAD_FOLDER ?? "vesture/products";

// Generate a signature the browser uses to upload directly to Cloudinary.
// The image bytes never touch our server, so this scales without us paying
// per-byte egress.
export function signUpload(params: { sellerId: string }): {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
} {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = `${UPLOAD_FOLDER}/${params.sellerId}`;

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
