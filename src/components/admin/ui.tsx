import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Building blocks of the admin pages. Server-safe (no hooks), so pages stay
 * Server Components and only forms are client code.
 */

export function PageHeader({
  title,
  intro,
  back,
  actions,
}: {
  title: ReactNode;
  intro?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          {intro && <p className="mt-1 max-w-2xl text-sm text-muted">{intro}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
  flush,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** No inner padding: for tables and lists that run edge to edge. */
  flush?: boolean;
}) {
  return (
    <section className={cn("rounded-2xl border border-line bg-surface", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
          {title && <h2 className="text-sm font-bold">{title}</h2>}
          {actions}
        </header>
      )}
      <div className={flush ? undefined : "p-5"}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  line,
  href,
  tone,
}: {
  label: string;
  value: ReactNode;
  line?: ReactNode;
  href?: string;
  tone?: "warn";
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-1 text-3xl font-extrabold tabular-nums tracking-tight", tone === "warn" && "text-deal")}>
        {value}
      </p>
      {line && <p className="mt-1 text-xs text-muted">{line}</p>}
    </>
  );
  const className = "block rounded-2xl border border-line bg-surface p-5";
  return href ? (
    <Link href={href} className={cn(className, "transition-colors hover:border-brand")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

const TONES = {
  neutral: "bg-surface-2 text-muted",
  good: "bg-brand-soft text-brand-strong",
  bad: "bg-deal-soft text-deal",
  info: "bg-global-soft text-global",
  strong: "bg-ink text-bg",
} as const;
export type BadgeTone = keyof typeof TONES;

export function Badge({
  tone = "neutral",
  children,
  title,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-sm", className)}>{children}</table>
    </div>
  );
}

export function Th({ children, className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, ...props }: ComponentProps<"td">) {
  return (
    <td className={cn("border-b border-line px-4 py-3 align-top", className)} {...props}>
      {children}
    </td>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-muted">{children}</p>;
}

/** Label / value rows. */
export function Facts({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
      {items.map((item, index) => (
        <div key={index} className="contents">
          <dt className="text-muted">{item.label}</dt>
          <dd className="min-w-0 break-words font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A message shown after an action, from `?notice=` in the address or a form's state. */
export function NoticeBanner({ tone = "good", children }: { tone?: "good" | "bad"; children: ReactNode }) {
  return (
    <p
      role={tone === "bad" ? "alert" : "status"}
      className={cn(
        "rounded-xl px-4 py-2.5 text-sm font-medium",
        tone === "good" ? "bg-brand-soft text-brand-strong" : "bg-deal-soft text-deal",
      )}
    >
      {children}
    </p>
  );
}

const control =
  "h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

/** Styles for the small inputs and selects of filter bars. */
export const filterControl = control;

/** A filter bar: a GET form, so filters live in the address and survive reloads and sharing. */
export function FilterBar({
  action,
  children,
  resetHref,
  labels,
}: {
  action: string;
  children: ReactNode;
  resetHref?: string;
  labels: { filter: string; reset: string };
}) {
  return (
    <form action={action} className="mb-4 flex flex-wrap items-center gap-2">
      {children}
      <button type="submit" className="h-9 rounded-lg bg-ink px-4 text-sm font-semibold text-bg hover:opacity-90">
        {labels.filter}
      </button>
      {resetHref && (
        <Link
          href={resetHref}
          className="h-9 rounded-lg px-3 text-sm leading-9 text-muted hover:bg-surface-2 hover:text-ink"
        >
          {labels.reset}
        </Link>
      )}
    </form>
  );
}
