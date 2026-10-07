import { azMarket } from "./az";
import type { MarketConfig } from "./types";

export type { MarketConfig } from "./types";

const MARKETS: Record<string, MarketConfig> = {
  [azMarket.code]: azMarket,
};

export function getMarket(code: string = process.env.MARKET ?? "az"): MarketConfig {
  const market = MARKETS[code];
  if (!market) throw new Error(`Unknown market "${code}"`);
  return market;
}
