"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  labels: { previous: string; next: string };
}

/**
 * A sideways-scrolling row of cards: swipe on touch screens, arrows on wider
 * ones, shown only where more cards are hidden. Each card snaps into place.
 */
export function CardSlider({ children, labels }: Props) {
  const row = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const list = row.current;
    if (!list) return;
    const update = () =>
      setEdges({
        start: list.scrollLeft > 4,
        end: list.scrollLeft + list.clientWidth < list.scrollWidth - 4,
      });
    update();
    list.addEventListener("scroll", update, { passive: true });
    // The cards too: the row's own box keeps its size while they are laid out (photos, fonts).
    const observer = new ResizeObserver(update);
    observer.observe(list);
    for (const card of list.children) observer.observe(card);
    return () => {
      list.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  const scrollBy = (direction: 1 | -1) =>
    row.current?.scrollBy({ left: direction * row.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className="relative">
      <ul ref={row} className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 py-1">
        {Children.map(children, (child) => (
          <li className="w-36 shrink-0 snap-start sm:w-40 lg:w-44">{child}</li>
        ))}
      </ul>
      {edges.start && <Arrow side="start" label={labels.previous} onClick={() => scrollBy(-1)} />}
      {edges.end && <Arrow side="end" label={labels.next} onClick={() => scrollBy(1)} />}
    </div>
  );
}

function Arrow({ side, label, onClick }: { side: "start" | "end"; label: string; onClick: () => void }) {
  const Icon = side === "start" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/3 hidden size-9 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface text-ink shadow-card transition-colors hover:bg-surface-2 md:grid ${
        side === "start" ? "-left-3" : "-right-3"
      }`}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}
