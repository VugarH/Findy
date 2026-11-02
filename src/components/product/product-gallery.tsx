"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { CategorySlug } from "@/config/categories";
import { ProductImage } from "./product-image";
import { ZoomImage } from "./zoom-image";

/** The product page's photo tile (also used for the placeholder when there is no photo). */
export const PHOTO_FRAME = "aspect-[4/3] overflow-hidden rounded-3xl border border-line bg-white sm:aspect-square";

/**
 * The product page photo: the selected photo large (magnified on hover), the
 * others as thumbnails underneath. One photo shows just the photo.
 */
export function ProductGallery({
  images: allImages,
  title,
  category,
  labels,
}: {
  images: string[];
  title: string;
  category: CategorySlug;
  labels: { photo: string };
}) {
  const [current, setCurrent] = useState(0);
  // A photo that no longer loads (the store replaced it) leaves the gallery instead of showing an empty box.
  const [failed, setFailed] = useState<string[]>([]);
  const images = allImages.filter((image) => !failed.includes(image));
  const fail = (image: string) => setFailed((list) => (list.includes(image) ? list : [...list, image]));
  const src = images[current] ?? images[0];
  if (!src) {
    return (
      <div className={PHOTO_FRAME}>
        <ProductImage imageUrl={null} title={title} category={category} />
      </div>
    );
  }
  return (
    <div>
      {/* A little room around the photo, so it does not touch the tile's edges. */}
      <div className={cn(PHOTO_FRAME, "p-3 sm:p-5")}>
        <ZoomImage key={src} src={src} alt={title} onFail={() => fail(src)} />
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
              <img src={image} alt="" loading="lazy" onError={() => fail(image)} className="size-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
