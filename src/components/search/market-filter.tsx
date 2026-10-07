import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SupplierScope } from "@/modules/suppliers/types";

interface Props {
  /** The market currently shown; undefined means both. */
  scope: SupplierScope | undefined;
  /** Builds the URL for a scope, keeping the query and sort. */
  hrefFor: (scope: SupplierScope | undefined) => string;
  labels: { title: string; local: string; global: string };
}

/**
 * Two tick boxes: local stores and stores abroad. Both ticked shows
 * everything. They are links, so they work without JavaScript; unticking the
 * last one ticks both again rather than leaving an empty page.
 */
export function MarketFilter({ scope, hrefFor, labels }: Props) {
  const other = (value: SupplierScope): SupplierScope => (value === "local" ? "global" : "local");
  const boxes = (["local", "global"] as const).map((value) => {
    const checked = scope === undefined || scope === value;
    // Unticking leaves the other market; ticking (or unticking the last one) shows both.
    const next = checked && scope === undefined ? other(value) : undefined;
    return { value, checked, href: hrefFor(next), label: value === "local" ? labels.local : labels.global };
  });

  return (
    <div role="group" aria-label={labels.title} className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <span className="text-muted">{labels.title}</span>
      {boxes.map((box) => (
        <Link
          key={box.value}
          href={box.href}
          role="checkbox"
          aria-checked={box.checked}
          scroll={false}
          className="group inline-flex items-center gap-2 font-medium text-ink"
        >
          <span
            aria-hidden
            className={cn(
              "grid size-[18px] place-items-center rounded-[5px] border transition-colors",
              box.checked ? "border-brand bg-brand text-on-brand" : "border-muted/60 bg-surface group-hover:border-muted",
            )}
          >
            {box.checked && <Check className="size-3.5" strokeWidth={3} />}
          </span>
          {box.label}
        </Link>
      ))}
    </div>
  );
}
