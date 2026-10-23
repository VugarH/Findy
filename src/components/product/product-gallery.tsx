"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { ZoomImage } from "./zoom-image";

/**
 * The product page photo: the selected photo large (magnified on hover), the
 * others as thumbnails underneath. One photo shows just the photo.
 */
export function ProductGallery({ images, title, labels }: { images: string[]; title: string; labels: { photo: string } }) {
  const [current, setCurrent] = useState(0);
  const src = images[current] ?? images[0];
  return (
    <div className="flex size-full flex-col bg-white">
      <div className="min-h-0 flex-1">
        <ZoomImage key={src} src={src} alt={title} />
      </div>
      {images.length > 1 && (
        <div className="flex justify-center gap-2 border-t border-line/60 p-2.5">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setCurrent(index)}
              onMouseEnter={() => setCurrent(index)}
              aria-label={`${labels.photo} ${index + 1}`}
              aria-pressed={index === current}
              className={cn(
                "size-14 overflow-hidden rounded-lg border-2 bg-white transition-colors",
                index === current ? "border-brand" : "border-line hover:border-muted",
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
