"use client";

import Image from "next/image";
import { useState } from "react";

export type GalleryImage = {
  id: string;
  url: string;
  alt: string | null;
};

export function ProductGallery({
  images,
  title,
}: {
  images: GalleryImage[];
  title: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];
  if (!active) return null;

  return (
    <div className="grid grid-cols-[88px_1fr] gap-4">
      <aside className="flex flex-col items-stretch gap-3">
        {images.slice(0, 5).map((img, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`Show image ${i + 1}`}
              aria-pressed={isActive}
              className={[
                "group relative aspect-square overflow-hidden rounded-lg bg-mist transition",
                isActive
                  ? "ring-2 ring-ink ring-offset-2 ring-offset-mist"
                  : "opacity-90 hover:opacity-100",
              ].join(" ")}
            >
              <Image
                src={img.url}
                alt={img.alt ?? `${title} thumbnail ${i + 1}`}
                fill
                sizes="88px"
                className="object-cover"
              />
            </button>
          );
        })}
        <p className="mt-1 text-[10px] font-medium tracking-wider text-ink/45">
          {String(activeIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
        </p>
      </aside>

      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-mist">
        <Image
          src={active.url}
          alt={active.alt ?? title}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
          priority={activeIndex === 0}
        />
      </div>
    </div>
  );
}
