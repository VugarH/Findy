"use client";

import Link from "next/link";
import { useState } from "react";
import { AUDIENCES } from "@/config/audience";
import { isCategorySlug } from "@/config/categories";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { bulkProductsAction } from "@/modules/admin/actions/products";
import type { AdminProductRow } from "@/modules/admin/products";
import { ProductImage } from "@/components/product/product-image";
import { useAdminT } from "./admin-i18n";
import { CategoryPicker } from "./category-picker";
import { FormMessage, SubmitButton, useAdminForm } from "./fields";
import { Badge, EmptyState, Table, Td, Th } from "./ui";

type Operation = "move" | "audience" | "on" | "off";

/** The product list with tick boxes and the action bar that changes every ticked product at once. */
export function ProductTable({ rows }: { rows: AdminProductRow[] }) {
  const t = useAdminT();
  const { t: site, href } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [operation, setOperation] = useState<Operation>("move");
  const [state, action] = useAdminForm(bulkProductsAction, (result) => {
    if (result.notice) setSelected(new Set());
  });

  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const b = t.products.bulk;
  const subName = (slug: string) => site.subcategories[slug as keyof typeof site.subcategories] ?? slug;

  if (rows.length === 0) return <EmptyState>{t.common.noResults}</EmptyState>;

  return (
    <form action={action}>
      <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
        <span className="mr-2 text-sm font-semibold tabular-nums">{fmt(b.selected, { count: selected.size })}</span>
        {selected.size > 0 && (
          <>
            <select
              name="operation"
              value={operation}
              onChange={(event) => setOperation(event.target.value as Operation)}
              aria-label={b.operation}
              className="h-9 rounded-lg border border-line bg-surface px-3 text-sm"
            >
              <option value="move">{b.move}</option>
              <option value="audience">{b.audience}</option>
              <option value="off">{b.off}</option>
              <option value="on">{b.on}</option>
            </select>
            {operation === "move" && <CategoryPicker compact required />}
            {operation === "audience" && (
              <select
                name="audience"
                aria-label={t.products.detail.audience}
                className="h-9 rounded-lg border border-line bg-surface px-3 text-sm"
              >
                <option value="auto">{t.common.automatic}</option>
                {AUDIENCES.map((audience) => (
                  <option key={audience} value={audience}>
                    {site.audiences[audience]}
                  </option>
                ))}
                <option value="none">{t.products.detail.audienceNone}</option>
              </select>
            )}
            <SubmitButton size="sm" pendingLabel={b.applying} className="h-9">
              {b.apply}
            </SubmitButton>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="h-9 rounded-lg px-3 text-sm text-muted hover:bg-surface-2"
            >
              {b.clear}
            </button>
          </>
        )}
      </div>
      {(state.notice || state.formError) && (
        <div className="px-4 pt-3">
          <FormMessage state={state} />
        </div>
      )}

      <Table>
        <thead>
          <tr>
            <Th className="w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)))}
                aria-label={b.selectAll}
                className="size-4 accent-brand"
              />
            </Th>
            <Th>{t.products.columns.product}</Th>
            <Th>{t.products.columns.category}</Th>
            <Th>{t.products.columns.stores}</Th>
            <Th className="text-right">{t.products.columns.offers}</Th>
            <Th>{t.products.columns.state}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={selected.has(row.id) ? "bg-brand-soft/30" : "hover:bg-surface-2/50"}>
              <Td>
                <input
                  type="checkbox"
                  name="ids"
                  value={row.id}
                  checked={selected.has(row.id)}
                  onChange={() => toggle(row.id)}
                  aria-label={row.title}
                  className="size-4 accent-brand"
                />
              </Td>
              <Td className="min-w-72">
                <div className="flex items-start gap-3">
                  <div className="size-10 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
                    {isCategorySlug(row.categorySlug) && (
                      <ProductImage imageUrl={row.imageUrl} title="" category={row.categorySlug} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={href(`/admin/products/${row.id}`)}
                      className="line-clamp-2 font-semibold hover:underline"
                    >
                      {row.title}
                    </Link>
                    <p className="truncate text-xs text-muted">{row.brand ?? "—"}</p>
                  </div>
                </div>
              </Td>
              <Td className="whitespace-nowrap">
                {isCategorySlug(row.categorySlug) ? site.categories[row.categorySlug].short : row.categorySlug}
                <span className="text-muted"> › {subName(row.subcategorySlug)}</span>
                {row.audience && (
                  <p className="text-xs text-muted">
                    {site.audiences[row.audience as keyof typeof site.audiences] ?? row.audience}
                  </p>
                )}
              </Td>
              <Td className="max-w-48 text-xs text-muted">
                {row.stores.slice(0, 2).join(", ")}
                {row.stores.length > 2 && ` +${row.stores.length - 2}`}
              </Td>
              <Td className="text-right tabular-nums">
                {fmt(t.products.offersLine, { live: row.liveOffers, total: row.offers })}
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {row.merged ? (
                    <Badge>{t.products.badges.merged}</Badge>
                  ) : !row.active ? (
                    <Badge tone="bad">{t.products.badges.off}</Badge>
                  ) : row.liveOffers === 0 ? (
                    <Badge>{t.products.badges.notLive}</Badge>
                  ) : null}
                  {row.hasDeal && <Badge tone="good">{t.products.badges.deal}</Badge>}
                  {row.lockedFields.length > 0 && <Badge tone="info">{t.products.badges.edited}</Badge>}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </form>
  );
}
