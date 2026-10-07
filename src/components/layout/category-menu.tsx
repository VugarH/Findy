"use client";

import Link from "next/link";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CategorySlug } from "@/config/categories";
import { CATEGORY_TEXT, CategoryIcon } from "@/components/ui/category-icon";
import { cn } from "@/lib/cn";

interface MenuItem {
  slug: CategorySlug;
  href: string;
  name: string;
  description: string;
}

/** "All categories" button in the header: every category at a glance, however many there are. */
export function CategoryMenu({
  label,
  items,
  extras = [],
}: {
  label: string;
  items: MenuItem[];
  /** Header links that do not fit on small screens; shown at the bottom of the menu there. */
  extras?: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-ink hover:bg-surface-2",
          open && "bg-surface-2",
        )}
      >
        <LayoutGrid className="size-4" aria-hidden />
        {label}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 grid w-[min(calc(100vw-2rem),40rem)] gap-1 rounded-2xl border border-line bg-surface p-2 shadow-card sm:grid-cols-2">
          {items.map((item) => (
            <Link
              key={item.slug}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-surface-2"
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2", CATEGORY_TEXT[item.slug])}>
                <CategoryIcon category={item.slug} className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{item.name}</span>
                <span className="block truncate text-xs font-normal text-muted">{item.description}</span>
              </span>
            </Link>
          ))}
          {extras.length > 0 && (
            <div className="flex flex-wrap gap-1 border-t border-line pt-1 sm:col-span-2 lg:hidden">
              {extras.map((extra) => (
                <Link
                  key={extra.href}
                  href={extra.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink"
                >
                  {extra.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
