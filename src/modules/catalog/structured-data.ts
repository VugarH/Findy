/**
 * The product described for search engines (schema.org Product, as JSON-LD),
 * so a result can show its price and photo. The prices are the ones the page
 * shows: the total in the market currency with delivery and customs.
 * Pure: the page passes in what it already has.
 */

export interface StructuredOffer {
  /** Landed total, minor units of the market currency. */
  priceMinor: number;
  inStock: boolean;
  store: string;
}

export interface StructuredProductInput {
  name: string;
  brand: string | null;
  images: string[];
  /** The product page's absolute address. */
  url: string;
  currency: string;
  offers: StructuredOffer[];
}

const price = (minor: number) => (minor / 100).toFixed(2);
const availability = (inStock: boolean) => `https://schema.org/${inStock ? "InStock" : "OutOfStock"}`;

export function productJsonLd(input: StructuredProductInput): Record<string, unknown> | null {
  if (input.offers.length === 0) return null;
  const inStock = input.offers.filter((offer) => offer.inStock);
  const priced = inStock.length > 0 ? inStock : input.offers;
  const prices = priced.map((offer) => offer.priceMinor);
  const low = Math.min(...prices);
  const offers =
    priced.length === 1
      ? {
          "@type": "Offer",
          price: price(low),
          priceCurrency: input.currency,
          availability: availability(inStock.length > 0),
          url: input.url,
          seller: { "@type": "Organization", name: priced[0].store },
        }
      : {
          "@type": "AggregateOffer",
          lowPrice: price(low),
          highPrice: price(Math.max(...prices)),
          priceCurrency: input.currency,
          offerCount: priced.length,
          availability: availability(inStock.length > 0),
          url: input.url,
        };
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    ...(input.brand ? { brand: { "@type": "Brand", name: input.brand } } : {}),
    ...(input.images.length ? { image: input.images } : {}),
    url: input.url,
    offers,
  };
}

/** The JSON for a <script type="application/ld+json">: "<" escaped, so a store's product name can never close the tag. */
export function jsonLdText(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
