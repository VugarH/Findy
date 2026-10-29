"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  /** The explanation shown. */
  info: string;
  children: ReactNode;
}

/** Hovering this long opens the explanation: a pointer just passing by does not. */
const OPEN_DELAY_MS = 500;
const WIDTH = 288;
const GUTTER = 16;

/**
 * A short explanation that appears when the pointer rests on `children` for
 * half a second, or when they get keyboard focus. Touch screens have no hover:
 * there the link itself leads to the full explanation. Rendered into
 * document.body, so a header's backdrop blur cannot pin or clip it.
 */
export function HoverInfo({ info, children }: Props) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const box = anchor.current?.getBoundingClientRect();
    if (!box) return;
    const left = Math.min(Math.max(GUTTER, box.left), window.innerWidth - WIDTH - GUTTER);
    setPosition({ top: box.bottom + 8, left: Math.max(GUTTER, left) });
  };
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const hide = () => {
    cancel();
    setPosition(null);
  };

  const open = position !== null;
  useEffect(() => {
    if (!open) return;
    // The page moved under it: close rather than float in the wrong place.
    const close = () => setPosition(null);
    window.addEventListener("scroll", close, { passive: true, once: true });
    return () => window.removeEventListener("scroll", close);
  }, [open]);
  useEffect(() => cancel, []);

  return (
    <span
      ref={anchor}
      className="inline-flex shrink-0"
      aria-describedby={position ? id : undefined}
      onMouseEnter={() => {
        cancel();
        timer.current = setTimeout(show, OPEN_DELAY_MS);
      }}
      onMouseLeave={hide}
      // Keyboard focus only: a mouse click focuses the link too, and is already leaving the page.
      onFocus={(event) => {
        if (event.target.matches(":focus-visible")) show();
      }}
      onBlur={hide}
    >
      {children}
      {position &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            style={{ top: position.top, left: position.left, width: WIDTH }}
            className="pointer-events-none fixed z-[70] rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-normal leading-relaxed text-ink shadow-card"
          >
            {info}
          </span>,
          document.body,
        )}
    </span>
  );
}
