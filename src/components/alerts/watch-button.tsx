"use client";

import { Bell, BellRing } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { useWatch } from "./watch-provider";

interface Props {
  productId: string;
  /** "icon" sits on a product card; "button" is the labelled one on the product page. */
  variant?: "icon" | "button";
  className?: string;
}

/** The bell that turns a product's price alert on or off. */
export function WatchButton({ productId, variant = "icon", className }: Props) {
  const { t } = useI18n();
  const { isWatched, toggle, pendingId } = useWatch();
  const watched = isWatched(productId);
  const Icon = watched ? BellRing : Bell;

  if (variant === "button") {
    return (
      <button
        type="button"
        aria-pressed={watched}
        disabled={pendingId === productId}
        onClick={() => toggle(productId)}
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition-colors disabled:opacity-60",
          watched ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-surface text-ink hover:bg-surface-2",
          className,
        )}
      >
        <Icon className="size-4" aria-hidden />
        {watched ? t.alerts.watching : t.alerts.watch}
      </button>
    );
  }

  const label = watched ? t.alerts.unwatchShort : t.alerts.watchShort;
  return (
    <button
      type="button"
      aria-pressed={watched}
      aria-label={label}
      title={label}
      disabled={pendingId === productId}
      onClick={() => toggle(productId)}
      className={cn(
        "grid size-9 place-items-center rounded-full border shadow-card transition-colors disabled:opacity-60",
        watched ? "border-brand bg-brand text-on-brand" : "border-line bg-surface text-muted hover:text-ink",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
