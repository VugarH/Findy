"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, Flame, House, ShoppingBag, Tag } from "lucide-react";
import { useCartItems } from "@/components/cart/cart-store";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";

/** Phones only: the main pages within thumb's reach. Wider screens have them in the header. */
export function MobileNav() {
  const { t, href } = useI18n();
  const pathname = usePathname();
  const count = useCartItems().reduce((sum, item) => sum + item.quantity, 0);
  const items = [
    { path: "/", label: t.nav.home, icon: House },
    { path: "/deals", label: t.nav.dealsShort, icon: Tag },
    { path: "/fresh", label: t.fresh.short, icon: BadgeCheck },
    { path: "/top", label: t.top.short, icon: Flame },
    { path: "/cart", label: t.cart.nav, icon: ShoppingBag, badge: count },
  ];

  return (
    <nav
      aria-label={t.nav.mainPages}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const target = href(item.path);
          const active = pathname === target || (item.path === "/" && pathname === href(""));
          return (
            <li key={item.path}>
              <Link
                href={target}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium leading-tight",
                  active ? "text-brand-strong" : "text-muted",
                )}
              >
                <span className="relative">
                  <item.icon className="size-5" aria-hidden />
                  {(item.badge ?? 0) > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-on-brand">
                      {item.badge! > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate px-0.5">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
