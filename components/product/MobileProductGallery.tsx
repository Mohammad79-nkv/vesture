"use client";

import Image from "next/image";
import { useState } from "react";
import type { GalleryImage } from "./ProductGallery";

// Full-bleed hero with tap-to-cycle and a 4-segment progress strip per the
// mobile design. Tap left third to go back, right two thirds to advance.
export function MobileProductGallery({
  images,
  title,
}: {
  images: GalleryImage[];
  title: string;
}) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];
  if (!current) return null;

  function next() {
    setActive((i) => (i + 1) % images.length);
  }
  function prev() {
    setActive((i) => (i - 1 + images.length) % images.length);
  }

  return (
    <div className="relative">
      <div className="relative aspect-[4/5] w-full bg-mist">
        <Image
          src={current.url}
          alt={current.alt ?? title}
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        {/* Tap zones — left third goes back, right two-thirds advances. */}
        <button
          type="button"
          aria-label="Previous image"
          onClick={prev}
          className="absolute inset-y-0 start-0 w-1/3"
        />
        <button
          type="button"
          aria-label="Next image"
          onClick={next}
          className="absolute inset-y-0 end-0 w-2/3"
        />
      </div>

      {/* 4-segment progress strip — capped at 4 even if there are more images,
          matching the design. Active segment is full opacity white. */}
      <div className="pointer-events-none absolute bottom-3.5 inset-x-3.5 flex gap-1.5">
        {images.slice(0, 4).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i === Math.min(active, 3) ? "bg-paper" : "bg-paper/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
