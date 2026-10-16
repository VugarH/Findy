import Link from "next/link";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A tick box that is a link: ticking or unticking opens the same page with
 * the setting changed, so it works without JavaScript and the choice lives in
 * the address. Used by the search switches.
 */
export function CheckLink({ href, checked, children }: { href: string; checked: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      role="checkbox"
      aria-checked={checked}
      scroll={false}
      className="group inline-flex items-center gap-2 text-sm font-medium text-ink"
    >
      <span
        aria-hidden
        className={cn(
          "grid size-[18px] place-items-center rounded-[5px] border transition-colors",
          checked ? "border-brand bg-brand text-on-brand" : "border-muted/60 bg-surface group-hover:border-muted",
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      {children}
    </Link>
  );
}
