"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { useFavorites } from "./favorite-store";

/** Favorites in the header, with how many products are saved. */
export function FavoritesLink() {
  const { t, href } = useI18n();
  const count = useFavorites().length;
  const active = usePathname() === href("/favorites");
  const label = count > 0 ? fmt(t.favorites.navCount, { count }) : t.favorites.nav;

  return (
    <Link
      href={href("/favorites")}
      aria-label={label}
      title={t.favorites.nav}
      className={cn(
        "relative grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-surface-2 hover:text-ink",
        active ? "bg-surface-2 text-ink" : "text-muted",
      )}
    >
      <Heart className="size-[18px]" aria-hidden />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-deal px-1 text-[11px] font-bold leading-[18px] text-on-deal">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
