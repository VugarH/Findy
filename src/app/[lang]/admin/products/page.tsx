import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { CATEGORIES, isCategorySlug } from "@/config/categories";
import { isSubcategoryOf, subcategoriesOf } from "@/config/subcategories";
import { fmt } from "@/i18n/format";
import { pageParam, param, type SearchParams } from "@/modules/admin/forms";
import { getAdminI18n } from "@/modules/admin/i18n";
import {
  listAdminProducts,
  PRODUCT_PAGE_SIZE,
  PRODUCT_SORTS,
  PRODUCT_STATUSES,
  type ProductSort,
  type ProductStatusFilter,
} from "@/modules/admin/products";
import { listStoreNames } from "@/modules/admin/stores";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { ProductTable } from "@/components/admin/product-table";
import { FilterBar, filterControl, PageHeader, Panel } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const { a } = await getAdminI18n();
  return { title: a.nav.products };
}

export default async function AdminProductsPage({ searchParams }: PageProps<"/[lang]/admin/products">) {
  const params: SearchParams = await searchParams;
  const { a, t, href, num } = await getAdminI18n();

  const category = param(params, "category");
  const categorySlug = isCategorySlug(category) ? category : undefined;
  const subcategory = param(params, "sub");
  const status = param(params, "status");
  const sort = param(params, "sort");
  const filters = {
    q: param(params, "q"),
    category: categorySlug ?? "",
    sub: categorySlug && isSubcategoryOf(categorySlug, subcategory) ? subcategory : "",
    store: param(params, "store"),
    status: (PRODUCT_STATUSES as readonly string[]).includes(status) ? status : "",
    live: param(params, "live") ? "1" : "",
    manual: param(params, "manual") ? "1" : "",
    locked: param(params, "locked") ? "1" : "",
    sort: (PRODUCT_SORTS as readonly string[]).includes(sort) ? sort : "",
  };
  const page = pageParam(params);

  const [{ rows, total }, stores] = await Promise.all([
    listAdminProducts(
      {
        q: filters.q || undefined,
        category: categorySlug,
        subcategory: filters.sub || undefined,
        store: filters.store || undefined,
        status: (filters.status || "active") as ProductStatusFilter,
        live: !!filters.live,
        manual: !!filters.manual,
        locked: !!filters.locked,
        sort: (filters.sort || "newest") as ProductSort,
      },
      page,
    ),
    listStoreNames(),
  ]);
  const path = href("/admin/products");
  const filtered = Object.values(filters).some(Boolean);
  const p = a.products;

  return (
    <>
      <PageHeader
        title={a.nav.products}
        intro={p.intro}
        actions={
          <ButtonLink href={href("/admin/products/new")} size="sm" className="rounded-lg">
            <Plus className="size-4" aria-hidden />
            {p.add}
          </ButtonLink>
        }
      />

      <FilterBar
        action={path}
        resetHref={filtered ? path : undefined}
        labels={{ filter: a.common.filter, reset: a.common.reset }}
      >
        <input
          name="q"
          defaultValue={filters.q}
          placeholder={p.searchPlaceholder}
          aria-label={a.common.search}
          className={`${filterControl} w-64`}
        />
        <select name="category" defaultValue={filters.category} aria-label={p.category} className={filterControl}>
          <option value="">{p.anyCategory}</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {t.categories[c.slug].name}
            </option>
          ))}
        </select>
        {categorySlug && (
          <select name="sub" defaultValue={filters.sub} aria-label={p.subcategory} className={filterControl}>
            <option value="">{p.anySubcategory}</option>
            {subcategoriesOf(categorySlug).map((slug) => (
              <option key={slug} value={slug}>
                {t.subcategories[slug]}
              </option>
            ))}
          </select>
        )}
        <select name="store" defaultValue={filters.store} aria-label={p.store} className={`${filterControl} max-w-48`}>
          <option value="">{p.anyStore}</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={filters.status || "active"} aria-label={p.status} className={filterControl}>
          {PRODUCT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {p.statuses[value]}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={filters.sort || "newest"} aria-label={p.sort} className={filterControl}>
          {PRODUCT_SORTS.map((value) => (
            <option key={value} value={value}>
              {p.sorts[value]}
            </option>
          ))}
        </select>
        {(
          [
            ["live", p.live],
            ["manual", p.manual],
            ["locked", p.locked],
          ] as const
        ).map(([name, label]) => (
          <label
            key={name}
            className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm"
          >
            <input
              type="checkbox"
              name={name}
              value="1"
              defaultChecked={!!filters[name]}
              className="size-4 accent-brand"
            />
            {label}
          </label>
        ))}
      </FilterBar>

      <Panel flush title={fmt(a.common.total, { count: num(total) })}>
        <ProductTable rows={rows} />
      </Panel>
      <AdminPagination path={path} filters={filters} page={page} pageSize={PRODUCT_PAGE_SIZE} total={total} t={t} />
    </>
  );
}
