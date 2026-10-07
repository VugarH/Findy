import { cn } from "@/lib/cn";

interface Props {
  sizes: { label: string; inStock: boolean }[];
  /** Read out after a sold-out size, which is shown crossed out. */
  soldOutLabel: string;
  /** Smaller chips, for the offers table. */
  compact?: boolean;
  className?: string;
}

/** A store's sizes for one listing: in-stock ones plain, sold-out ones crossed out. Server-safe. */
export function SizeList({ sizes, soldOutLabel, compact = false, className }: Props) {
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {sizes.map((size) => (
        <li
          key={size.label}
          className={cn(
            "rounded-md border tabular-nums",
            compact ? "px-1.5 py-0.5 text-[11px]" : "min-w-9 px-2 py-1 text-center text-xs font-semibold",
            size.inStock ? "border-line bg-surface text-ink" : "border-dashed border-line text-muted line-through",
          )}
        >
          {size.label}
          {!size.inStock && <span className="sr-only"> ({soldOutLabel})</span>}
        </li>
      ))}
    </ul>
  );
}
