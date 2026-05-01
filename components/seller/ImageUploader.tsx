"use client";

import { useState } from "react";

export type UploadedImage = {
  url: string;
  publicId: string;
  position: number;
};

type SignatureResponse = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
};

async function uploadOne(file: File, sig: SignatureResponse): Promise<UploadedImage> {
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
    { method: "POST", body: form },
  );
  if (!res.ok) {
    throw new Error(`Cloudinary upload failed: ${res.status}`);
  }
  const data = (await res.json()) as { secure_url: string; public_id: string };
  return { url: data.secure_url, publicId: data.public_id, position: 0 };
}

export function ImageUploader({
  value,
  onChange,
  max = 8,
}: {
  value: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
  max?: number;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const sigRes = await fetch("/api/upload", { method: "POST" });
      if (!sigRes.ok) throw new Error("Could not get upload signature");
      const sig = (await sigRes.json()) as SignatureResponse;

      const slots = Math.max(0, max - value.length);
      const queued = Array.from(files).slice(0, slots);
      const uploaded = await Promise.all(queued.map((f) => uploadOne(f, sig)));
      const positioned = uploaded.map((img, i) => ({
        ...img,
        position: value.length + i,
      }));
      onChange([...value, ...positioned]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function remove(publicId: string) {
    const next = value
      .filter((img) => img.publicId !== publicId)
      .map((img, i) => ({ ...img, position: i }));
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {value.map((img) => (
          <div
            key={img.publicId}
            className="relative aspect-square overflow-hidden border border-ink/10 bg-mist"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <button
              type="button"
              onClick={() => remove(img.publicId)}
              className="absolute end-1 top-1 bg-ink/80 px-2 py-1 text-xs text-paper"
            >
              ×
            </button>
          </div>
        ))}

        {value.length < max && (
          <label className="flex aspect-square cursor-pointer items-center justify-center border border-dashed border-ink/30 bg-mist text-sm text-ink/60 hover:border-ink/60">
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={uploading}
              onChange={(e) => handleFiles(e.target.files)}
            />
            {uploading ? "Uploading…" : "+ Add"}
          </label>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
