import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";

/**
 * The mark: a lowercase "f" holding a magnifying glass with a check mark —
 * we find deals and check them. Theme colours; the same drawing, in fixed
 * colours, is app/icon1.svg (browser tab), app/icon2.png, app/apple-icon.png
 * and public/icon-192.png (notifications).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" aria-hidden className={cn("shrink-0", className)}>
      <rect width="80" height="80" rx="22" className="fill-brand" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" className="stroke-on-brand">
        <path d="M29 66 L29 30 C29 20 33 15 40 15" strokeWidth="9" />
        <path d="M16 42 L42 42 L49 35" strokeWidth="7" />
        <circle cx="57" cy="27" r="10" strokeWidth="5" className="fill-brand" />
        <path d="M53 27 L56 30 L61.5 23.5" strokeWidth="3" />
      </g>
    </svg>
  );
}

export function Logo({ href }: { href: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2 text-xl font-extrabold tracking-tight text-ink">
      <LogoMark className="size-8" />
      <span className="lowercase">{siteConfig.name}</span>
    </Link>
  );
}
