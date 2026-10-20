"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CategorySlug } from "@/config/categories";
import { CATEGORY_TEXT, CategoryIcon } from "@/components/ui/category-icon";

interface Item {
  slug: CategorySlug;
  href: string;
  name: string;
}

interface Props {
  items: Item[];
  labels: { previous: string; next: string };
}

/**
 * Every category as a sideways-scrolling row of chips. The open category is
 * highlighted; the edges fade, with arrows on wider screens, only where more
 * chips are hidden.
 */
export function CategorySlider({ items, labels }: Props) {
  const pathname = usePathname();
  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const update = () =>
      setEdges({
        start: row.scrollLeft > 4,
        end: row.scrollLeft + row.clientWidth < row.scrollWidth - 4,
      });
    update();
    row.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => {
      row.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  // Bring the open category into view (e.g. "Toys" at the far end).
  useEffect(() => {
    rowRef.current?.querySelector<HTMLElement>("[aria-current=page]")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  function scrollBy(direction: 1 | -1) {
    const row = rowRef.current;
    if (row) row.scrollBy({ left: direction * row.clientWidth * 0.7, behavior: "smooth" });
  }

  const fade = `linear-gradient(to right, ${edges.start ? "transparent" : "black"}, black 40px, black calc(100% - 40px), ${edges.end ? "transparent" : "black"})`;

  return (
    <div className="relative min-w-0 flex-1">
      <div
        ref={rowRef}
        className="no-scrollbar flex items-center gap-1.5 overflow-x-auto px-1 py-1"
        style={{ maskImage: fade, WebkitMaskImage: fade }}
      >
        {items.map((item) => {
          const active = pathname.includes(`/category/${item.slug}`);
          return (
            <Link
              key={item.slug}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 transition-all duration-200 ${
                active
                  ? "border-brand bg-brand-soft font-semibold text-brand-strong shadow-card"
                  : "border-line bg-surface text-muted hover:-translate-y-px hover:border-brand/40 hover:text-ink hover:shadow-card"
              }`}
            >
              <span
                className={`grid size-5 place-items-center rounded-full bg-surface-2 transition-transform duration-200 group-hover:scale-110 ${CATEGORY_TEXT[item.slug]}`}
              >
                <CategoryIcon category={item.slug} className="size-3.5" />
              </span>
              {item.name}
            </Link>
          );
        })}
      </div>
      {edges.start && (
        <SlideButton side="start" label={labels.previous} onClick={() => scrollBy(-1)} />
      )}
      {edges.end && <SlideButton side="end" label={labels.next} onClick={() => scrollBy(1)} />}
    </div>
  );
}

function SlideButton({ side, label, onClick }: { side: "start" | "end"; label: string; onClick: () => void }) {
  const Icon = side === "start" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 hidden size-7 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface text-ink shadow-card transition-colors hover:bg-surface-2 md:grid ${
        side === "start" ? "left-0" : "right-0"
      }`}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
