import type { StructuredProduct } from "../parse";

/**
 * Farmasi (farmasi.com.tr) has no schema.org data: its Next.js pages embed
 * the product in __NEXT_DATA__ (props.pageProps.productData) with the price,
 * the previous price Turkish law requires shops to show (referencePrice),
 * stock and photos.
 */
interface FarmasiProduct {
  name?: string;
  code?: string;
  brandName?: string | null;
  price?: number;
  retailPrice?: number | null;
  referencePrice?: number | null;
  currencyCode?: string;
  stock?: boolean;
  discontinued?: boolean;
  images?: { imageUrl?: string }[];
}

export function readFarmasiProduct(html: string): StructuredProduct | null {
  const json = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!json) return null;
  let product: FarmasiProduct | undefined;
  try {
    product = (JSON.parse(json) as { props?: { pageProps?: { productData?: FarmasiProduct } } }).props?.pageProps?.productData;
  } catch {
    return null;
  }
  if (!product?.name || !product.code || typeof product.price !== "number" || product.price <= 0) return null;
  const before = Math.max(product.referencePrice ?? 0, product.retailPrice ?? 0);
  return {
    name: product.name,
    brand: "Farmasi",
    sku: product.code,
    mpn: null,
    gtin: null,
    image: product.images?.[0]?.imageUrl ?? null,
    price: product.price,
    currency: product.currencyCode ?? null,
    inStock: product.stock === true && product.discontinued !== true,
    listPrice: before > product.price ? before : null,
  };
}
