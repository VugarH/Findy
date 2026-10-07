import Link from "next/link";
import { cn } from "@/lib/cn";

export interface SizeOptionLink {
  key: string;
  total: number;
  /** URL with this size ticked or unticked. */
  href: string;
  active: boolean;
}

/**
 * Size buttons for clothes and shoes. Each is a link that adds or removes the
 * size, so several can be combined ("42 or 42.5") and the choice lives in the URL.
 */
export function SizeFilter({ options, hint }: { options: SizeOptionLink[]; hint: string }) {
  return (
    <div className="px-2">
      <ul className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <li key={option.key}>
            <Link
              href={option.href}
              scroll={false}
              role="checkbox"
              aria-checked={option.active}
              aria-label={`${option.key} (${option.total})`}
              className={cn(
                "grid h-8 min-w-10 place-items-center rounded-lg border px-2 text-[13px] font-semibold tabular-nums transition-colors",
                option.active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink hover:border-ink",
              )}
            >
              {option.key}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">{hint}</p>
    </div>
  );
}
