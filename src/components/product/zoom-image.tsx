"use client";

import { useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { largeImage } from "@/config/images";

/** How much the side panel enlarges the photo. */
const ZOOM = 2.5;
/** Space between the photo tile and the side panel, in px. */
const GAP = 16;

interface View {
  /** Where the side panel goes: beside the photo's tile (the parent element), the same size. */
  panel: DOMRect;
  /** Where the photo itself sits inside its frame (object-contain leaves margins). */
  content: { left: number; top: number; width: number; height: number };
  /** Lens top-left corner, relative to the frame. */
  lens: { left: number; top: number; width: number; height: number };
}

/**
 * Product photo with a Trendyol-style magnifier on devices with a mouse: a lens
 * follows the pointer and a panel beside the photo shows that part enlarged.
 * Without room for the panel (narrow windows), nothing happens; touch screens
 * see the plain photo.
 */
export function ZoomImage({ src, alt }: { src: string; alt: string }) {
  const [view, setView] = useState<View | null>(null);

  const move = (event: MouseEvent<HTMLDivElement>) => {
    // A tap on a touch screen fires mouse events too; zoom only with a real pointer.
    if (!window.matchMedia("(hover: hover)").matches) return;
    const image = event.currentTarget.querySelector("img");
    if (!image?.naturalWidth) return;
    const box = event.currentTarget.getBoundingClientRect();
    const panel = (event.currentTarget.parentElement ?? event.currentTarget).getBoundingClientRect();
    // The panel is as big as the photo tile, so it needs that much room to the right.
    if (panel.right + GAP + panel.width > window.innerWidth) return setView(null);

    const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const content = { left: (box.width - width) / 2, top: (box.height - height) / 2, width, height };
    // The lens covers what the panel shows, kept inside the photo.
    const lensWidth = Math.min(panel.width / ZOOM, width);
    const lensHeight = Math.min(panel.height / ZOOM, height);
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const lens = {
      left: clamp(event.clientX - box.left - lensWidth / 2, content.left, content.left + width - lensWidth),
      top: clamp(event.clientY - box.top - lensHeight / 2, content.top, content.top + height - lensHeight),
      width: lensWidth,
      height: lensHeight,
    };
    setView({ panel, content, lens });
  };

  return (
    <div
      className="relative size-full overflow-hidden bg-white [@media(hover:hover)]:cursor-crosshair"
      onMouseMove={move}
      onMouseLeave={() => setView(null)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- supplier images come from arbitrary hosts */}
      <img src={src} alt={alt} className="size-full object-contain" />
      {view && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute border border-black/25 bg-black/10"
            style={view.lens}
          />
          {/* On top of the page beside the photo (fixed), so the frame's overflow does not clip it. */}
          {createPortal(
            <div
              aria-hidden
              className="pointer-events-none fixed z-50 overflow-hidden rounded-2xl border border-line bg-white bg-no-repeat shadow-xl"
              style={{
                left: view.panel.right + GAP,
                top: view.panel.top,
                width: view.panel.width,
                height: view.panel.height,
                backgroundImage: `url("${largeImage(src)}")`,
                backgroundSize: `${view.content.width * ZOOM}px ${view.content.height * ZOOM}px`,
                backgroundPosition: `${-(view.lens.left - view.content.left) * ZOOM}px ${-(view.lens.top - view.content.top) * ZOOM}px`,
              }}
            />,
            document.body,
          )}
        </>
      )}
    </div>
  );
}
