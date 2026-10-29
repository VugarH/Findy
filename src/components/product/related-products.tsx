import { getI18n } from "@/i18n/server";
import { relatedDeals, type RelatedSource } from "@/modules/catalog/related";
import { MiniProductCard } from "@/components/deals/mini-product-card";
import { CardSlider } from "@/components/ui/card-slider";

/** Cards in the row: more than fit at once, the rest a swipe away. */
const SHOWN = 16;

/**
 * "Similar items" under a product (modules/catalog/related.ts), as one
 * sideways row of small cards. An async component: the product page wraps it
 * in Suspense, so the page never waits for it. Renders nothing when too few fit.
 */
export async function RelatedProducts({ source }: { source: RelatedSource }) {
  const { t, money, href, market } = await getI18n();
  const cards = await relatedDeals(market, source, SHOWN).catch(() => []);
  if (cards.length === 0) return null;
  return (
    <section className="mt-12" aria-labelledby="related-title">
      <h2 id="related-title" className="mb-3 text-lg font-bold">
        {t.product.similarTitle}
      </h2>
      <CardSlider labels={{ previous: t.product.similarPrevious, next: t.product.similarNext }}>
        {cards.map((card) => (
          <MiniProductCard key={card.productId} card={card} money={money} href={href} />
        ))}
      </CardSlider>
    </section>
  );
}
