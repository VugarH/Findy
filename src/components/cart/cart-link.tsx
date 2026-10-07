"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { CART_ADDED, CART_REMOVED, useCartItems } from "./cart-store";

/** The cart in the header, with how many items it holds, and the short "Added" / "Removed" messages. */
export function CartLink() {
  const { t, href } = useI18n();
  const c = t.cart;
  const pathname = usePathname();
  const count = useCartItems().reduce((sum, item) => sum + item.quantity, 0);
  const [message, setMessage] = useState<{ text: string; link: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const show = (text: string, link: boolean) => {
      setMessage({ text, link });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), 4000);
    };
    const onAdded = () => show(c.added, true);
    const onRemoved = () => show(c.removed, false);
    const onFull = (event: Event) => show((event as CustomEvent<string>).detail, true);
    window.addEventListener(CART_ADDED, onAdded);
    window.addEventListener(CART_REMOVED, onRemoved);
    window.addEventListener("serfeli:cart-full", onFull);
    return () => {
      window.removeEventListener(CART_ADDED, onAdded);
      window.removeEventListener(CART_REMOVED, onRemoved);
      window.removeEventListener("serfeli:cart-full", onFull);
      clearTimeout(timer.current);
    };
  }, [c.added, c.removed]);

  const onCartPage = pathname === href("/cart");
  const label = count > 0 ? fmt(c.navCount, { count }) : c.nav;

  return (
    <>
      <Link
        href={href("/cart")}
        aria-label={label}
        title={c.nav}
        className={cn(
          "relative grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-surface-2 hover:text-ink",
          onCartPage ? "bg-surface-2 text-ink" : "text-muted",
        )}
      >
        <ShoppingBag className="size-[18px]" aria-hidden />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[11px] font-bold leading-[18px] text-on-brand">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
      {/* Portalled: the header's backdrop blur would otherwise pin a fixed element inside the header. */}
      {message &&
        createPortal(
          <p
            role="status"
            className="fixed bottom-5 left-1/2 z-50 flex w-[min(28rem,92vw)] -translate-x-1/2 items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-bg shadow-card"
          >
            <span>{message.text}</span>
            {message.link && !onCartPage && (
              <Link href={href("/cart")} onClick={() => setMessage(null)} className="shrink-0 font-bold underline">
                {c.view}
              </Link>
            )}
          </p>,
          document.body,
        )}
    </>
  );
}
