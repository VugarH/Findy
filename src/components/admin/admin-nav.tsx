"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowUpDown,
  FolderTree,
  LayoutDashboard,
  Package,
  PlayCircle,
  Send,
  Settings,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { useAdminT } from "./admin-i18n";

/**
 * The admin menu. A new section is one entry here, one key under `nav` in
 * the admin dictionaries and a folder under app/[lang]/admin.
 */
const SECTIONS = [
  { path: "", key: "dashboard", icon: LayoutDashboard },
  { path: "/stores", key: "stores", icon: Store },
  { path: "/products", key: "products", icon: Package },
  { path: "/categories", key: "categories", icon: FolderTree },
  { path: "/order", key: "order", icon: ArrowUpDown },
  { path: "/orders", key: "orders", icon: ShoppingBag },
  { path: "/runs", key: "runs", icon: PlayCircle },
  { path: "/telegram", key: "telegram", icon: Send },
  { path: "/activity", key: "activity", icon: Activity },
  { path: "/users", key: "users", icon: Users },
  { path: "/settings", key: "settings", icon: Settings },
] as const;

export function AdminNav({ badges }: { badges: Partial<Record<(typeof SECTIONS)[number]["key"], number>> }) {
  const t = useAdminT();
  const { href } = useI18n();
  const pathname = usePathname();
  const root = href("/admin");

  return (
    <nav
      aria-label={t.nav.menu}
      className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto lg:mx-0 lg:flex-col lg:overflow-visible"
    >
      {SECTIONS.map(({ path, key, icon: Icon }) => {
        const target = root + path;
        const active = path === "" ? pathname === root : pathname.startsWith(target);
        const badge = badges[key];
        return (
          <Link
            key={key}
            href={target}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-ink text-bg" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span className="flex-1">{t.nav[key]}</span>
            {badge ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-bold leading-[18px]",
                  active ? "bg-bg text-ink" : "bg-deal text-on-deal",
                )}
              >
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
