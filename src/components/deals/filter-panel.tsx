import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A titled block in the filter panel. */
export function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line py-3 first:pt-0 last:border-0">
      <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

/** One selectable value: a plain link, so filtering works without JavaScript. */
export function FilterOption({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2 py-1 text-[13px] transition-colors hover:bg-surface-2",
        // An empty value stays in place (lists keep their length as filters change) but recedes.
        active ? "font-semibold text-ink" : count === 0 ? "text-muted" : "text-ink",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-3.5 shrink-0 place-items-center rounded-full border",
          active ? "border-brand bg-brand" : "border-muted/50 group-hover:border-muted",
        )}
      >
        {active && <span className="size-1.5 rounded-full bg-on-brand" />}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count !== undefined && <span className="text-xs text-muted tabular-nums">{count}</span>}
    </Link>
  );
}

/** An on/off filter: a checkbox drawn as a link, like FilterOption. */
export function FilterToggle({
  href,
  active,
  count,
  hint,
  children,
}: {
  href: string;
  active: boolean;
  count?: number;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      role="checkbox"
      aria-checked={active}
      className="group flex items-start gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink transition-colors hover:bg-surface-2"
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-4 shrink-0 place-items-center rounded border",
          active ? "border-brand bg-brand text-on-brand" : "border-muted/50 group-hover:border-muted",
        )}
      >
        {active && (
          <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 6.5 5 9l4.5-6" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block", active && "font-semibold")}>{children}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
      {count !== undefined && <span className="text-xs text-muted tabular-nums">{count}</span>}
    </Link>
  );
}
