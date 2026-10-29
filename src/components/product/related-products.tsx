import { getI18n } from "@/i18n/server";
import { relatedDeals, type RelatedSource } from "@/modules/catalog/related";
import { ProductGrid } from "@/components/deals/product-grid";

/**
 * "Similar items" under a product (modules/catalog/related.ts). An async
 * component: the product page wraps it in Suspense, so the page never waits
 * for it. Renders nothing when too few deals fit.
 */
export async function RelatedProducts({ source }: { source: RelatedSource }) {
  const { t, money, href, market } = await getI18n();
  const cards = await relatedDeals(market, source).catch(() => []);
  if (cards.length === 0) return null;
  return (
    <section className="mt-12" aria-labelledby="related-title">
      <h2 id="related-title" className="mb-4 text-lg font-bold">
        {t.product.similarTitle}
      </h2>
      <ProductGrid cards={cards} t={t} money={money} href={href} />
    </section>
  );
}
