import type { AkinonStore } from "./adapter";

/**
 * Akinon stores read through their category pages (see ./adapter.ts).
 * Checked on 2026-10-11.
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
];
