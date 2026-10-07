import Link from "next/link";
import type { AdminEvent } from "@/db/schema";
import { isCategorySlug } from "@/config/categories";
import { isAudience } from "@/config/audience";
import { isCurrencyCode } from "@/config/currencies";
import { fmt } from "@/i18n/format";
import type { AdminAction } from "@/modules/admin/audit";
import type { AdminI18n } from "@/modules/admin/i18n";
import { Badge, EmptyState } from "./ui";

const ENTITY_PATHS: Record<string, (id: string) => string> = {
  store: (id) => `/admin/stores/${id}`,
  product: (id) => `/admin/products/${id}`,
  order: () => "/admin/orders",
  user: () => "/admin/users",
};

/** A short, readable account of what an event changed, from its details. */
function detailOf(event: AdminEvent, { a, t, money }: Pick<AdminI18n, "a" | "t" | "money">): string | null {
  const d = event.details as Record<string, unknown>;
  switch (event.action as AdminAction) {
    case "product.move": {
      const category = String(d.category ?? "");
      if (!isCategorySlug(category)) return null;
      const sub = String(d.subcategory ?? "");
      const subName =
        sub === "auto" ? a.common.automatic : (t.subcategories[sub as keyof typeof t.subcategories] ?? sub);
      return `→ ${t.categories[category].name} › ${subName}`;
    }
    case "product.audience": {
      const audience = String(d.audience ?? "");
      return `→ ${isAudience(audience) ? t.audiences[audience] : audience === "none" ? a.products.detail.audienceNone : a.common.automatic}`;
    }
    case "product.merge":
      return d.intoTitle ? `→ ${String(d.intoTitle)}` : null;
    case "product.update":
      return Array.isArray(d.changed) ? d.changed.join(", ") : null;
    case "offer.create":
    case "offer.update":
    case "offer.delete": {
      const currency = String(d.currency ?? "");
      return typeof d.price === "number" && isCurrencyCode(currency)
        ? `${String(d.store ?? "")} · ${money(d.price, currency)}`
        : null;
    }
    case "order.status": {
      const status = String(d.status ?? "") as keyof typeof t.order.status;
      return t.order.status[status] ?? null;
    }
    case "user.role": {
      const role = String(d.role ?? "") as keyof typeof a.users.roles;
      return a.users.roles[role] ?? null;
    }
    case "deals.publish":
      return typeof d.deals === "number" ? fmt(a.notices.published, { count: d.deals }) : null;
    default:
      return null;
  }
}

export function ActivityList({
  events,
  i18n,
  publishedAt,
}: {
  events: AdminEvent[];
  i18n: Pick<AdminI18n, "a" | "t" | "href" | "money" | "dateTime">;
  /** Changes after this time that need publishing are marked as not on the site yet. */
  publishedAt: Date | null;
}) {
  const { a, href, dateTime } = i18n;
  if (events.length === 0) return <EmptyState>{a.activity.empty}</EmptyState>;

  return (
    <ul className="divide-y divide-line">
      {events.map((event) => {
        const path = ENTITY_PATHS[event.entityType]?.(event.entityId);
        const detail = detailOf(event, i18n);
        const unpublished = event.needsPublish && (!publishedAt || event.createdAt > publishedAt);
        return (
          <li key={event.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-5 py-3 text-sm">
            <span className="font-semibold">{event.userEmail}</span>
            <span className="text-muted">{a.activity.actions[event.action as AdminAction] ?? event.action}</span>
            {event.entityType !== "deals" &&
              (path ? (
                <Link href={href(path)} className="min-w-0 font-medium text-brand-strong hover:underline">
                  {event.entityLabel}
                </Link>
              ) : (
                <span className="font-medium">{event.entityLabel}</span>
              ))}
            {detail && <span className="text-muted">{detail}</span>}
            {unpublished && <Badge tone="info">{a.activity.notPublished}</Badge>}
            <time className="ml-auto whitespace-nowrap text-xs text-muted" dateTime={event.createdAt.toISOString()}>
              {dateTime(event.createdAt)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
