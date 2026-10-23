"use client";

import { useState, type MouseEvent } from "react";

const ZOOM = 2.2;

/**
 * Product photo that magnifies under the pointer on devices with a mouse
 * (hover: hover); touch screens see the plain photo.
 */
export function ZoomImage({ src, alt }: { src: string; alt: string }) {
  const [origin, setOrigin] = useState<string | null>(null);
  const move = (event: MouseEvent<HTMLDivElement>) => {
    // A tap on a touch screen fires mouse events too; zoom only with a real pointer.
    if (!window.matchMedia("(hover: hover)").matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * 100;
    const y = ((event.clientY - box.top) / box.height) * 100;
    setOrigin(`${x}% ${y}%`);
  };
  return (
    <div
      className="size-full overflow-hidden bg-white [@media(hover:hover)]:cursor-zoom-in"
      onMouseMove={move}
      onMouseLeave={() => setOrigin(null)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- supplier images come from arbitrary hosts */}
      <img
        src={src}
        alt={alt}
        className="size-full object-contain transition-transform duration-150 ease-out"
        style={origin ? { transformOrigin: origin, transform: `scale(${ZOOM})` } : undefined}
      />
    </div>
  );
}
