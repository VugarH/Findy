/**
 * Product families people in Azerbaijan look for most, used to build the
 * "Popular" section and to measure how well our stores cover real demand.
 *
 * Basis (checked 2026-09-30): Apple, Samsung and Xiaomi together hold about
 * two thirds of the country's phone market, and local stores' own "popular
 * searches" lists lead with iPhone and Redmi. This is a curated list, not
 * Google Trends data — revise it from `search_queries` once the site has
 * traffic of its own.
 *
 * Shoes and watches (added 2026-10-01): well-known best-selling sneaker
 * models and watch lines, carried by several of our Turkish and foreign
 * stores. Also curated, not measured.
 *
 * `pattern` is a PostgreSQL case-insensitive regex matched against product titles.
 */
import type { CategorySlug } from "./categories";
import type { SubcategorySlug } from "./subcategories";

export interface PopularFamily {
  id: string;
  label: string;
  /** What the tile searches for. */
  query: string;
  pattern: string;
  /** Only products of this type count, so "iPhone 17" means the phone, not its cases. */
  subcategory?: SubcategorySlug;
  /** Or, where the subcategory varies (men's / women's watches), only this category. */
  category?: CategorySlug;
  /** The maker. Excludes accessory brands whose product names mention the device. */
  brand: string;
}

export const POPULAR_FAMILIES: PopularFamily[] = [
  { id: "iphone-18", label: "iPhone 18", query: "iphone 18", pattern: "\\miphone 18", subcategory: "phones", brand: "Apple" },
  { id: "iphone-17", label: "iPhone 17", query: "iphone 17", pattern: "\\miphone 17", subcategory: "phones", brand: "Apple" },
  { id: "iphone-16", label: "iPhone 16", query: "iphone 16", pattern: "\\miphone 16", subcategory: "phones", brand: "Apple" },
  { id: "galaxy-s", label: "Samsung Galaxy S", query: "galaxy s2", pattern: "\\mgalaxy s2[0-9]", subcategory: "phones", brand: "Samsung" },
  { id: "galaxy-a", label: "Samsung Galaxy A", query: "galaxy a", pattern: "\\mgalaxy a[0-9]{2}", subcategory: "phones", brand: "Samsung" },
  { id: "redmi-note", label: "Redmi Note", query: "redmi note", pattern: "\\mredmi note", subcategory: "phones", brand: "Xiaomi" },
  { id: "honor", label: "Honor", query: "honor", pattern: "^honor\\M", subcategory: "phones", brand: "Honor" },
  { id: "ipad", label: "iPad", query: "ipad", pattern: "\\mipad\\M", subcategory: "tablets-computers", brand: "Apple" },
  { id: "galaxy-tab", label: "Galaxy Tab", query: "galaxy tab", pattern: "\\mgalaxy tab", subcategory: "tablets-computers", brand: "Samsung" },
  { id: "macbook", label: "MacBook", query: "macbook", pattern: "\\mmacbook", subcategory: "tablets-computers", brand: "Apple" },
  { id: "airpods", label: "AirPods", query: "airpods", pattern: "\\mairpods", subcategory: "audio", brand: "Apple" },
  { id: "apple-watch", label: "Apple Watch", query: "apple watch", pattern: "\\mapple watch", subcategory: "wearables", brand: "Apple" },
  { id: "galaxy-watch", label: "Galaxy Watch", query: "galaxy watch", pattern: "\\mgalaxy watch", subcategory: "wearables", brand: "Samsung" },
  { id: "adidas-samba", label: "adidas Samba", query: "adidas samba", pattern: "\\msamba\\M", subcategory: "sneakers", brand: "adidas" },
  { id: "adidas-gazelle", label: "adidas Gazelle", query: "adidas gazelle", pattern: "\\mgazelle\\M", subcategory: "sneakers", brand: "adidas" },
  { id: "adidas-campus", label: "adidas Campus", query: "adidas campus", pattern: "\\mcampus\\M", subcategory: "sneakers", brand: "adidas" },
  { id: "nike-air-force-1", label: "Nike Air Force 1", query: "air force 1", pattern: "\\mair force 1", category: "shoes", brand: "Nike" },
  { id: "nike-air-max", label: "Nike Air Max", query: "air max", pattern: "\\mair max", category: "shoes", brand: "Nike" },
  { id: "puma-palermo", label: "Puma Palermo", query: "puma palermo", pattern: "\\mpalermo\\M", category: "shoes", brand: "Puma" },
  { id: "puma-suede", label: "Puma Suede", query: "puma suede", pattern: "\\msuede\\M", category: "shoes", brand: "Puma" },
  { id: "new-balance-530", label: "New Balance 530", query: "new balance 530", pattern: "\\m530\\M", category: "shoes", brand: "New Balance" },
  { id: "chuck-taylor", label: "Converse Chuck Taylor", query: "chuck taylor", pattern: "\\mchuck (taylor|70)", category: "shoes", brand: "Converse" },
  { id: "g-shock", label: "Casio G-Shock", query: "g-shock", pattern: "g-?shock|\\mga-?\\d{3,4}", category: "watches", brand: "Casio" },
  { id: "tissot-prx", label: "Tissot PRX", query: "tissot prx", pattern: "\\mprx\\M", category: "watches", brand: "Tissot" },
  { id: "stanley-quencher", label: "Stanley Quencher", query: "stanley quencher", pattern: "\\mquencher\\M", brand: "Stanley" },
  { id: "theragun", label: "Theragun", query: "theragun", pattern: "\\mtheragun\\M", category: "sports", brand: "Therabody" },
  { id: "playstation", label: "PlayStation 5", query: "playstation 5", pattern: "\\mplaystation 5 (slim|pro|digital)|\\mps5 (slim|pro)\\M", subcategory: "keyboards-gaming", brand: "Sony" },
];
