"use client";

import { ArrowDown, ArrowUp, ArrowUpToLine, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { CATEGORY_SLUGS, type CategorySlug } from "@/config/categories";
import { subcategoriesOf, type SubcategorySlug } from "@/config/subcategories";
import { useI18n } from "@/i18n/client";
import { LOCALE_TAGS } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { saveDisplayOrderAction } from "@/modules/admin/actions/settings";
import type { OrderingCounts } from "@/modules/admin/ordering";
import { brandKey } from "@/modules/catalog/brand";
import { MAX_TOP_BRANDS, type DisplayOrder } from "@/modules/settings/display-order";
import { useAdminT } from "./admin-i18n";
import { FormMessage, SubmitButton, useAdminForm } from "./fields";
import { Panel } from "./ui";

interface Props {
  /** Every category and every category's types, already in the saved order. */
  categories: CategorySlug[];
  subcategories: Record<CategorySlug, SubcategorySlug[]>;
  brands: string[];
  counts: OrderingCounts;
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Settings → Order: arrange categories, each category's types and the top
 * brands. Everything is saved together with one button.
 */
export function DisplayOrderForm({ categories: savedCategories, subcategories: savedSubs, brands: savedBrands, counts }: Props) {
  const a = useAdminT();
  const o = a.order;
  const { t, locale } = useI18n();
  const [state, action] = useAdminForm(saveDisplayOrderAction);
  const [categories, setCategories] = useState(savedCategories);
  const [subcategories, setSubcategories] = useState(savedSubs);
  const [brands, setBrands] = useState(savedBrands);
  const [typesOf, setTypesOf] = useState<CategorySlug>(savedCategories[0]);
  const [newBrand, setNewBrand] = useState("");
  const listId = useId();

  const order: DisplayOrder = { categories, subcategories, brands };
  const saved: DisplayOrder = { categories: savedCategories, subcategories: savedSubs, brands: savedBrands };
  const dirty = JSON.stringify(order) !== JSON.stringify(saved);

  const number = (value: number) => value.toLocaleString(LOCALE_TAGS[locale]);
  const dealsLabel = (value: number | undefined) => fmt(o.deals, { count: number(value ?? 0) });
  const brandInfo = new Map(counts.brands.map((brand) => [brand.key, brand]));
  const brandName = (key: string) => brandInfo.get(key)?.name ?? key;

  const addBrand = () => {
    const typed = newBrand.trim();
    if (!typed) return;
    const match = counts.brands.find((brand) => brand.name.toLowerCase() === typed.toLowerCase());
    const key = match?.key ?? brandKey(typed);
    if (!brands.includes(key) && brands.length < MAX_TOP_BRANDS) setBrands([...brands, key]);
    setNewBrand("");
  };

  const types = subcategories[typesOf];
  const setTypes = (next: SubcategorySlug[]) => setSubcategories({ ...subcategories, [typesOf]: next });
  const byDeals = <T,>(list: T[], dealsOf: (item: T) => number) =>
    [...list].sort((x, y) => dealsOf(y) - dealsOf(x));

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="order" value={JSON.stringify(order)} />

      <Panel
        title={o.categoriesTitle}
        actions={
          <ListButton onClick={() => setCategories(byDeals(categories, (slug) => counts.categories[slug] ?? 0))}>
            {o.byDeals}
          </ListButton>
        }
      >
        <p className="mb-3 text-sm text-muted">{o.categoriesIntro}</p>
        <OrderList
          items={categories}
          label={(slug) => t.categories[slug].name}
          detail={(slug) => dealsLabel(counts.categories[slug])}
          onChange={setCategories}
        />
      </Panel>

      <Panel
        title={o.typesTitle}
        actions={
          <ListButton onClick={() => setTypes(byDeals(types, (slug) => counts.subcategories[`${typesOf}/${slug}`] ?? 0))}>
            {o.byDeals}
          </ListButton>
        }
      >
        <p className="mb-3 text-sm text-muted">{o.typesIntro}</p>
        <label className="mb-3 flex items-center gap-2 text-sm font-semibold">
          {o.category}
          <select
            value={typesOf}
            onChange={(event) => setTypesOf(event.target.value as CategorySlug)}
            className="h-9 rounded-lg border border-line bg-surface px-2 text-sm font-normal"
          >
            {categories.map((slug) => (
              <option key={slug} value={slug}>
                {t.categories[slug].name}
              </option>
            ))}
          </select>
        </label>
        <OrderList
          items={types}
          label={(slug) => t.subcategories[slug]}
          detail={(slug) => dealsLabel(counts.subcategories[`${typesOf}/${slug}`])}
          onChange={setTypes}
        />
      </Panel>

      <Panel title={o.brandsTitle}>
        <p className="mb-3 text-sm text-muted">{o.brandsIntro}</p>
        {brands.length === 0 ? (
          <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">{o.noBrands}</p>
        ) : (
          <OrderList
            items={brands}
            label={brandName}
            detail={(key) => dealsLabel(brandInfo.get(key)?.deals)}
            onChange={setBrands}
            onRemove={(key) => setBrands(brands.filter((brand) => brand !== key))}
          />
        )}
        {brands.length < MAX_TOP_BRANDS && (
          <div className="mt-3 flex max-w-md gap-2">
            <input
              list={listId}
              value={newBrand}
              onChange={(event) => setNewBrand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addBrand();
                }
              }}
              placeholder={o.addBrandPlaceholder}
              aria-label={o.addBrand}
              className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm"
            />
            <datalist id={listId}>
              {counts.brands
                .filter((brand) => !brands.includes(brand.key))
                .map((brand) => (
                  <option key={brand.key} value={brand.name}>
                    {dealsLabel(brand.deals)}
                  </option>
                ))}
            </datalist>
            <ListButton onClick={addBrand}>{o.add}</ListButton>
          </div>
        )}
      </Panel>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-line bg-bg/95 py-3 backdrop-blur">
        <SubmitButton pendingLabel={a.common.saving} disabled={!dirty}>
          {a.common.save}
        </SubmitButton>
        <ListButton
          onClick={() => {
            setCategories([...CATEGORY_SLUGS]);
            setSubcategories(Object.fromEntries(CATEGORY_SLUGS.map((slug) => [slug, subcategoriesOf(slug)])) as Props["subcategories"]);
            setBrands([]);
          }}
        >
          {o.reset}
        </ListButton>
        {dirty && <span className="text-sm font-semibold text-deal">{o.unsaved}</span>}
        {!dirty && <FormMessage state={state} />}
      </div>
    </form>
  );
}

function ListButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 shrink-0 rounded-lg border border-line bg-surface px-3 text-sm font-semibold hover:bg-surface-2"
    >
      {children}
    </button>
  );
}

/** A numbered list with move-up / move-down / to-the-top buttons on every row. */
function OrderList<T extends string>({
  items,
  label,
  detail,
  onChange,
  onRemove,
}: {
  items: T[];
  label: (item: T) => string;
  detail: (item: T) => string;
  onChange: (next: T[]) => void;
  onRemove?: (item: T) => void;
}) {
  const o = useAdminT().order;
  const icon = "grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <ol className="divide-y divide-line rounded-xl border border-line">
      {items.map((item, index) => (
        <li key={item} className="flex items-center gap-2 px-3 py-1.5">
          <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted">{index + 1}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{label(item)}</span>
          <span className="hidden shrink-0 text-xs tabular-nums text-muted sm:inline">{detail(item)}</span>
          <button type="button" className={icon} disabled={index === 0} onClick={() => onChange(move(items, index, 0))} aria-label={`${o.top}: ${label(item)}`} title={o.top}>
            <ArrowUpToLine className="size-4" aria-hidden />
          </button>
          <button type="button" className={icon} disabled={index === 0} onClick={() => onChange(move(items, index, index - 1))} aria-label={`${o.up}: ${label(item)}`} title={o.up}>
            <ArrowUp className="size-4" aria-hidden />
          </button>
          <button type="button" className={icon} disabled={index === items.length - 1} onClick={() => onChange(move(items, index, index + 1))} aria-label={`${o.down}: ${label(item)}`} title={o.down}>
            <ArrowDown className="size-4" aria-hidden />
          </button>
          {onRemove && (
            <button type="button" className={icon} onClick={() => onRemove(item)} aria-label={`${o.remove}: ${label(item)}`} title={o.remove}>
              <X className="size-4" aria-hidden />
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}
