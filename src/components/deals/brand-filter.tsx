"use client";

import Link from "next/link";
import { Check, ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export interface BrandOption {
  key: string;
  name: string;
  total: number;
  /** URL with this brand ticked or unticked. */
  href: string;
  active: boolean;
}

/** Brands shown before "Show all". */
const VISIBLE = 8;
/** From this many brands on, the expanded list gets a search box. */
const SEARCHABLE = 12;

/**
 * Tick-box list of brands. Each box is a link that adds or removes the brand,
 * so several can be combined and the selection lives in the URL.
 */
export function BrandFilter({
  options,
  labels,
}: {
  options: BrandOption[];
  labels: { showAll: string; showFewer: string; search: string; none: string };
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");

  // Ticked brands stay on top, whatever their size.
  const ordered = [...options.filter((o) => o.active), ...options.filter((o) => !o.active)];
  const needle = query.trim().toLowerCase();
  const shown = expanded
    ? ordered.filter((o) => !needle || o.name.toLowerCase().includes(needle))
    : ordered.slice(0, Math.max(VISIBLE, options.filter((o) => o.active).length));

  return (
    <div>
      {expanded && options.length >= SEARCHABLE && (
        <label className="mb-1.5 flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5">
          <Search className="size-3.5 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.search}
            aria-label={labels.search}
            className="h-8 w-full min-w-0 bg-transparent text-[13px] outline-none"
          />
        </label>
      )}

      <ul className={cn(expanded && "max-h-80 overflow-y-auto pr-1")}>
        {shown.map((option) => (
          <li key={option.key}>
            <Link
              href={option.href}
              scroll={false}
              role="checkbox"
              aria-checked={option.active}
              className="group flex items-center gap-2 rounded-lg px-2 py-1 text-[13px] text-ink hover:bg-surface-2"
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-3.5 shrink-0 place-items-center rounded border",
                  option.active ? "border-brand bg-brand text-on-brand" : "border-muted/50 group-hover:border-muted",
                )}
              >
                {option.active && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className={cn("min-w-0 flex-1 truncate", option.active && "font-semibold")}>{option.name}</span>
              <span className="text-xs text-muted tabular-nums">{option.total}</span>
            </Link>
          </li>
        ))}
        {expanded && shown.length === 0 && <li className="px-2 py-1 text-[13px] text-muted">{labels.none}</li>}
      </ul>

      {options.length > VISIBLE && (
        <button
          type="button"
          onClick={() => {
            setExpanded((value) => !value);
            setQuery("");
          }}
          aria-expanded={expanded}
          className="mt-1 flex items-center gap-1 px-2 text-[13px] font-semibold text-brand-strong hover:underline"
        >
          {expanded ? labels.showFewer : labels.showAll}
          <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
      )}
    </div>
  );
}
