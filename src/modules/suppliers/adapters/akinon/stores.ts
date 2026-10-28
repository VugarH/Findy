import type { AkinonStore } from "./adapter";

/**
 * Akinon stores read through their category pages (see ./adapter.ts).
 * Checked on 2026-10-11; Lacoste and Paşabahçe added on 2026-10-28.
 */
export const AKINON_STORES: AkinonStore[] = [
  {
    id: "superstep",
    name: "SuperStep",
    origin: "https://www.superstep.com.tr",
    originCountry: "TR",
    currency: "TRY",
    reliability: { basis: "established-retailer", note: "One of Turkey's largest sneaker and sportswear chains, selling adidas, Nike, Puma, New Balance and others" },
    shipsToMarket: false,
    categories: ["shoes", "bags", "fashion"],
    listings: ["/erkek/", "/kadin/", "/cocuk/"],
    maxDiscounted: 3000,
  },
  {
    id: "sportive",
    name: "Sportive",
    origin: "https://www.sportive.com.tr",
    originCountry: "TR",
    currency: "TRY",
    reliability: { basis: "established-retailer", note: "Turkish sportswear and sneaker chain selling Nike, adidas, Hoka, New Balance and others" },
    shipsToMarket: false,
    categories: ["shoes", "fashion", "sports", "bags"],
    listings: ["/erkek/", "/kadin/", "/cocuk/"],
    maxDiscounted: 3000,
  },
  {
    id: "lacoste-tr",
    name: "Lacoste Türkiye",
    origin: "https://www.lacoste.com.tr",
    originCountry: "TR",
    currency: "TRY",
    reliability: { basis: "official-brand-store", note: "Lacoste's official online store for Turkey" },
    shipsToMarket: false,
    categories: ["shoes", "bags", "watches", "jewelry", "fashion"],
    fallbackCategory: "fashion",
    brand: "Lacoste",
    listings: ["/tum-urunler/"],
    maxDiscounted: 2000,
    allProducts: true,
  },
  {
    id: "pasabahce",
    name: "Paşabahçe",
    origin: "https://www.pasabahce.com",
    originCountry: "TR",
    currency: "TRY",
    reliability: { basis: "official-brand-store", note: "Official store of Paşabahçe (Şişecam), Turkey's best-known glassware and tableware maker" },
    shipsToMarket: false,
    categories: ["home"],
    fallbackCategory: "home",
    brand: "Paşabahçe",
    listings: ["/sofra/", "/icecek-1/", "/mutfak/", "/ev-yasam/"],
    maxDiscounted: 2000,
    allProducts: true,
  },
];
