/**
 * Checks whether a store can be connected through the structured-data adapter,
 * before writing its entry in src/modules/suppliers/adapters/structured-data/stores.ts.
 *
 *   npm run store:probe -- www.superstep.com.tr
 *   npm run store:probe -- www.gratis.com www.flormar.com.tr
 *
 * For each store: robots.txt and its sitemaps, the sitemap that lists products,
 * and three product pages read exactly as the adapter would — name, brand,
 * price, currency, stock — plus which crossed-out-price source matches.
 */
import { PoliteClient } from "@/modules/suppliers/http";
import { RobotsPolicy } from "@/modules/suppliers/robots";
import {
  LIST_PRICE_SOURCES,
  readListPrice,
  readSitemap,
  readStructuredProduct,
  type SitemapEntry,
} from "@/modules/suppliers/adapters/structured-data/parse";
const PRODUCT_HINT = /product|urun|ürün/i;

async function probe(host: string): Promise<string[]> {
  const origin = `https://${host.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  const client = new PoliteClient({ delayMs: 800, maxRequests: 12, timeoutMs: 60_000 });
  const out = [`##### ${origin}`];

  const robotsText = await client.get(`${origin}/robots.txt`);
  if (robotsText.status !== 200 && robotsText.status !== 404) return [...out, `robots.txt: HTTP ${robotsText.status} — blocked`];
  const robots = robotsText.status === 404 ? RobotsPolicy.parse("") : RobotsPolicy.parse(robotsText.text);
  const declared = [...robotsText.text.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]);
  const root = declared[0] ?? `${origin}/sitemap.xml`;
  out.push(`sitemaps in robots.txt: ${declared.join(" ") || "none (trying /sitemap.xml)"}`);

  const index = readSitemap(await client.getText(root));
  let entries: SitemapEntry[] = index.entries;
  let productSitemap = root;
  if (index.isIndex) {
    const child = index.entries.find((e) => PRODUCT_HINT.test(e.url)) ?? index.entries[0];
    if (!child) return [...out, `${root}: empty sitemap index`];
    out.push(`index lists ${index.entries.length} sitemaps: ${index.entries.slice(0, 6).map((e) => e.url).join(" ")}`);
    productSitemap = child.url;
    entries = readSitemap(await client.getText(child.url)).entries;
  }
  const allowed = entries.filter((e) => e.url.startsWith(origin) && robots.allows(new URL(e.url).pathname));
  out.push(`${productSitemap}: ${entries.length} URLs, ${allowed.length} allowed, lastmod ${entries[0]?.lastmod ? "yes" : "no"}`);

  // Spread the samples over the list: the first URLs are often categories.
  const samples = [0.3, 0.6, 0.9].map((f) => allowed[Math.floor(allowed.length * f)]).filter(Boolean);
  for (const { url } of samples) {
    const page = await client.get(url);
    const product = page.status === 200 ? readStructuredProduct(page.text) : null;
    if (!product) {
      out.push(`  ✗ ${url} (HTTP ${page.status}, no schema.org Product)`);
      continue;
    }
    const lists = LIST_PRICE_SOURCES.flatMap((source) => {
      const value = readListPrice(page.text, product.price, source);
      return value ? [`${source}=${value}`] : [];
    });
    out.push(
      `  ✓ ${product.name.slice(0, 50)} | brand ${product.brand ?? "-"} | ${product.price} ${product.currency ?? "?"} | ` +
        `${product.inStock ? "in stock" : "sold out"} | sku ${product.sku ?? "-"} gtin ${product.gtin ?? "-"} | list: ${lists.join(" ") || "-"}`,
    );
    out.push(`    ${url}`);
  }
  return out;
}

const hosts = process.argv.slice(2);
if (hosts.length === 0) {
  console.error("usage: npm run store:probe -- <host> [host…]");
  process.exit(2);
}
const results = await Promise.all(
  hosts.map((host) => probe(host).catch((error: Error) => [`##### ${host}`, `failed: ${error.message}`])),
);
console.log(results.map((lines) => lines.join("\n")).join("\n\n"));
