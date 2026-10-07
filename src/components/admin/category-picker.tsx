"use client";

import { useState } from "react";
import { CATEGORIES, isCategorySlug, type CategorySlug } from "@/config/categories";
import { subcategoriesOf } from "@/config/subcategories";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { useAdminT } from "./admin-i18n";

/**
 * Category + subcategory selects, where the second lists the first one's
 * subcategories. "auto" lets the rules choose the subcategory.
 */
export function CategoryPicker({
  category: initialCategory,
  subcategory: initialSubcategory,
  automaticNow,
  errors,
  compact,
  required,
}: {
  category?: string;
  /** A subcategory slug or "auto". */
  subcategory?: string;
  /** What the rules picked, shown on the "Automatic" option. */
  automaticNow?: string;
  errors?: { category?: string; subcategory?: string };
  /** One line, for the bulk action bar. */
  compact?: boolean;
  required?: boolean;
}) {
  const t = useAdminT();
  const { t: site } = useI18n();
  const [category, setCategory] = useState<CategorySlug | "">(
    initialCategory && isCategorySlug(initialCategory) ? initialCategory : "",
  );
  const [subcategory, setSubcategory] = useState(initialSubcategory ?? "auto");
  const subcategoryName = (slug: string) => site.subcategories[slug as keyof typeof site.subcategories] ?? slug;
  const control = cn(
    "rounded-lg border bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25",
    compact ? "h-9" : "h-10 w-full",
  );
  const errorText = (key?: string) => (key ? (t.errors[key as keyof typeof t.errors] ?? t.errors.invalid) : null);

  const categorySelect = (
    <select
      name="categorySlug"
      value={category}
      required={required}
      aria-label={t.products.detail.category}
      onChange={(event) => {
        setCategory(event.target.value as CategorySlug);
        setSubcategory("auto");
      }}
      className={cn(control, errors?.category && "border-deal")}
    >
      <option value="">—</option>
      {CATEGORIES.map((c) => (
        <option key={c.slug} value={c.slug}>
          {site.categories[c.slug].name}
        </option>
      ))}
    </select>
  );
  const subcategorySelect = (
    <select
      name="subcategory"
      value={subcategory}
      disabled={!category}
      aria-label={t.products.detail.subcategory}
      onChange={(event) => setSubcategory(event.target.value)}
      className={cn(control, errors?.subcategory && "border-deal")}
    >
      <option value="auto">
        {automaticNow && category === initialCategory
          ? fmt(t.common.automaticNow, { value: subcategoryName(automaticNow) })
          : t.common.automatic}
      </option>
      {category &&
        subcategoriesOf(category).map((slug) => (
          <option key={slug} value={slug}>
            {subcategoryName(slug)}
          </option>
        ))}
    </select>
  );

  if (compact) {
    return (
      <>
        {categorySelect}
        {subcategorySelect}
      </>
    );
  }
  return (
    <>
      <div>
        <p className="mb-1 text-sm font-semibold">{t.products.detail.category}</p>
        {categorySelect}
        {errors?.category && <p className="mt-1 text-xs font-medium text-deal">{errorText(errors.category)}</p>}
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold">{t.products.detail.subcategory}</p>
        {subcategorySelect}
        {errors?.subcategory && <p className="mt-1 text-xs font-medium text-deal">{errorText(errors.subcategory)}</p>}
      </div>
    </>
  );
}
