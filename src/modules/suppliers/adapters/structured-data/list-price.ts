/**
 * Where a store keeps the crossed-out price. Structured data has only the
 * selling price, so each store names the one place on its pages that has the
 * old one (recorded in its access method).
 */
export type ListPriceSource =
  /** Akinon platform: the product JSON's "retail_price". */
  | "retail-price"
  /** A page-state JSON with "oldPrice". */
  | "old-price-json"
  /** A page-state JSON with "old_price". */
  | "old-price-field"
  /** Google Analytics 4 item data: price + "discount". */
  | "ga4-discount"
  /** schema.org's own crossed-out price: a priceSpecification of type StrikethroughPrice. */
  | "strikethrough"
  /** Akinon's older (Omnishop) pages: the crossed-out price is a `-retail` element, `<div class="price -retail"><pz-price>599</pz-price>`. */
  | "retail-element";

/** Every crossed-out-price source the adapter can read, for forms and validation. */
export const LIST_PRICE_SOURCES = [
  "retail-price",
  "old-price-json",
  "old-price-field",
  "ga4-discount",
  "strikethrough",
  "retail-element",
] as const satisfies readonly ListPriceSource[];
