"use client";

import Link from "next/link";
import { Check, ShoppingBag, X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { CART_LIMITS } from "@/modules/cart/items";
import { cart, useCartItems } from "./cart-store";

interface Props {
  offerId: string;
  /** "icon" sits on a product card, "button" on the product page, "text" in the offers table. */
  variant?: "icon" | "button" | "text";
  className?: string;
}

/**
 * Adds a store's listing to the cart. Once it is there the button says so,
 * links to the cart and can take it out again, so a misclick is undone in place.
 */
export function CartButton({ offerId, variant = "icon", className }: Props) {
  const { t, href } = useI18n();
  const c = t.cart;
  const inCart = useCartItems().some((item) => item.offerId === offerId);

  function add() {
    if (cart.add(offerId) === "full") alertFull(fmt(c.full, { max: CART_LIMITS.lines }));
  }
  const remove = () => cart.undoAdd(offerId);

  if (variant === "icon") {
    // On a card the bag is a toggle: pressed again, it takes the item out.
    return (
      <button
        type="button"
        onClick={inCart ? remove : add}
        aria-pressed={inCart}
        aria-label={inCart ? c.remove : c.add}
        title={inCart ? c.remove : c.add}
        className={cn(
          "grid size-9 place-items-center rounded-full border shadow-card transition-colors",
          inCart ? "border-brand bg-brand text-on-brand" : "border-line bg-surface text-muted hover:text-ink",
          className,
        )}
      >
        <span className="relative">
          <ShoppingBag className="size-4" aria-hidden />
          {inCart && (
            <Check className="absolute -bottom-1 -right-1.5 size-3 rounded-full bg-brand stroke-[3]" aria-hidden />
          )}
        </span>
      </button>
    );
  }

  if (variant === "text") {
    const style = "inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold hover:underline";
    return inCart ? (
      <span className={cn("inline-flex items-center gap-2", className)}>
        <Link href={href("/cart")} className={cn(style, "text-muted")}>
          <Check className="size-4" aria-hidden />
          {c.inCart}
        </Link>
        <button
          type="button"
          onClick={remove}
          className="text-xs font-semibold text-muted hover:text-deal hover:underline"
        >
          {c.remove}
        </button>
      </span>
    ) : (
      <button type="button" onClick={add} className={cn(style, "text-ink", className)}>
        <ShoppingBag className="size-4" aria-hidden />
        {c.add}
      </button>
    );
  }

  const style = cn(
    "inline-flex h-11 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition-colors",
    inCart ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-surface text-ink hover:bg-surface-2",
  );
  return inCart ? (
    <span className={cn("inline-flex items-stretch gap-1.5", className)}>
      <Link href={href("/cart")} className={cn(style, "min-w-0 flex-1")}>
        <Check className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{c.inCartView}</span>
      </Link>
      <button
        type="button"
        onClick={remove}
        aria-label={c.remove}
        title={c.remove}
        className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted transition-colors hover:border-deal hover:text-deal"
      >
        <X className="size-4" aria-hidden />
      </button>
    </span>
  ) : (
    <button type="button" onClick={add} className={cn(style, className)}>
      <ShoppingBag className="size-4" aria-hidden />
      {c.add}
    </button>
  );
}

/** Rare enough (30 different products) that the shared message is the cart toast's job. */
function alertFull(message: string) {
  window.dispatchEvent(new CustomEvent("serfeli:cart-full", { detail: message }));
}
