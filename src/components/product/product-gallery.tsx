"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { ZoomImage } from "./zoom-image";

/** The product page's photo tile (also used for the placeholder when there is no photo). */
export const PHOTO_FRAME = "aspect-[4/3] overflow-hidden rounded-3xl border border-line bg-white sm:aspect-square";

/**
 * The product page photo: the selected photo large (magnified on hover), the
 * others as thumbnails underneath. One photo shows just the photo.
 */
export function ProductGallery({ images, title, labels }: { images: string[]; title: string; labels: { photo: string } }) {
  const [current, setCurrent] = useState(0);
  const src = images[current] ?? images[0];
  return (
    <div>
      {/* A little room around the photo, so it does not touch the tile's edges. */}
      <div className={cn(PHOTO_FRAME, "p-3 sm:p-5")}>
        <ZoomImage key={src} src={src} alt={title} />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2.5">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setCurrent(index)}
              onMouseEnter={() => setCurrent(index)}
              aria-label={`${labels.photo} ${index + 1}`}
              aria-pressed={index === current}
              className={cn(
                "size-16 overflow-hidden rounded-xl border-2 bg-white p-1 transition sm:size-20",
                index === current ? "border-brand" : "border-line opacity-75 hover:opacity-100",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- supplier images come from arbitrary hosts */}
              <img src={image} alt="" loading="lazy" className="size-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
