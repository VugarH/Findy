"use client";

import { Heart } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { favorites, useFavorites } from "./favorite-store";

interface Props {
  productId: string;
  /** "icon" sits on a product card; "button" is the labelled one on the product page. */
  variant?: "icon" | "button";
  className?: string;
}

/** The heart that saves a product to Favorites (in this browser). */
export function FavoriteButton({ productId, variant = "icon", className }: Props) {
  const { t } = useI18n();
  const saved = useFavorites().includes(productId);
  const toggle = () => favorites.toggle(productId);

  if (variant === "button") {
    return (
      <button
        type="button"
        aria-pressed={saved}
        onClick={toggle}
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition-colors",
          saved ? "border-deal bg-surface-2 text-deal" : "border-line bg-surface text-ink hover:bg-surface-2",
          className,
        )}
      >
        <Heart className={cn("size-4", saved && "fill-current")} aria-hidden />
        {saved ? t.favorites.saved : t.favorites.save}
      </button>
    );
  }

  const label = saved ? t.favorites.unsave : t.favorites.save;
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={label}
      title={label}
      onClick={toggle}
      className={cn(
        "grid size-9 place-items-center rounded-full border border-line bg-surface shadow-card transition-colors",
        saved ? "text-deal" : "text-muted hover:text-ink",
        className,
      )}
    >
      <Heart className={cn("size-4", saved && "fill-current")} aria-hidden />
    </button>
  );
}
