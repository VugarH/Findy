import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  page: number;
  pages: number;
  /** Builds the href for a page number, keeping the current filters. */
  hrefFor: (page: number) => string;
  /** Where the "go to page" form submits, and the filters it must carry along. */
  jump: { action: string; params: Record<string, string> };
  labels: { prev: string; next: string; goToPage: string; go: string; pagination: string };
}

/** 1 … 4 5 [6] 7 8 … 20 */
export function pageWindow(page: number, pages: number): (number | "gap")[] {
  const keep = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter((n) => n >= 1 && n <= pages));
  const sorted = [...keep].sort((a, b) => a - b);
  const result: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) result.push("gap");
    result.push(n);
  });
  return result;
}

const cell = "grid h-9 min-w-9 place-items-center rounded-full px-2 text-sm font-medium tabular-nums";

export function Pagination({ page, pages, hrefFor, jump, labels }: Props) {
  if (pages <= 1) return null;

  return (
    <nav aria-label={labels.pagination} className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <ul className="flex items-center gap-1">
        <li>
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} aria-label={labels.prev} className={cn(cell, "text-ink hover:bg-surface-2")}>
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
          ) : (
            <span className={cn(cell, "text-line")}>
              <ChevronLeft className="size-4" aria-hidden />
            </span>
          )}
        </li>
        {pageWindow(page, pages).map((entry, index) =>
          entry === "gap" ? (
            <li key={`gap-${index}`} className={cn(cell, "min-w-6 px-0 text-muted")} aria-hidden>
              …
            </li>
          ) : (
            <li key={entry}>
              <Link
                href={hrefFor(entry)}
                aria-current={entry === page ? "page" : undefined}
                className={cn(cell, entry === page ? "bg-ink text-bg" : "text-ink hover:bg-surface-2")}
              >
                {entry}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < pages ? (
            <Link href={hrefFor(page + 1)} aria-label={labels.next} className={cn(cell, "text-ink hover:bg-surface-2")}>
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span className={cn(cell, "text-line")}>
              <ChevronRight className="size-4" aria-hidden />
            </span>
          )}
        </li>
      </ul>

      {/* A plain GET form, so jumping to a page works without JavaScript. */}
      <form action={jump.action} className="flex items-center gap-2 text-sm text-muted">
        {Object.entries(jump.params).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <label className="flex items-center gap-2">
          {labels.goToPage}
          <input
            type="number"
            name="page"
            min={1}
            max={pages}
            required
            placeholder={`1–${pages}`}
            className="h-9 w-20 rounded-full border border-line bg-surface px-3 text-sm text-ink tabular-nums"
          />
        </label>
        <button
          type="submit"
          className="h-9 rounded-full border border-line bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-2"
        >
          {labels.go}
        </button>
      </form>
    </nav>
  );
}
