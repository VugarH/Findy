import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { fxRates } from "@/db/schema";
import type { CurrencyCode } from "@/config/currencies";
import { getMarket, type MarketConfig } from "@/config/markets";
import { parseCbarRates } from "./cbar";

const CACHE_MS = 10 * 60_000;
let cache: { code: string; at: number; market: MarketConfig } | null = null;

async function fetchCbarRates(date: Date): Promise<Partial<Record<CurrencyCode, number>>> {
  // The bulletin is dated in Baku time (UTC+4).
  const baku = new Date(date.getTime() + 4 * 3_600_000);
  const stamp = [baku.getUTCDate(), baku.getUTCMonth() + 1].map((n) => String(n).padStart(2, "0")).join(".");
  const response = await fetch(`https://www.cbar.az/currencies/${stamp}.${baku.getUTCFullYear()}.xml`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`cbar.az answered ${response.status}`);
  return parseCbarRates(await response.text());
}

/**
 * Pulls today's official rates and stores them. Called at the start of the
 * daily job. On failure the previously stored (or configured) rates stay in use.
 */
export async function refreshFxRates(market: MarketConfig, now: Date): Promise<{ ok: boolean; error?: string }> {
  if (market.fxSource !== "cbar") return { ok: true };
  try {
    const rates = await fetchCbarRates(now);
    const rows = Object.entries(rates).map(([currency, rate]) => ({ marketCode: market.code, currency, rate, fetchedAt: now }));
    if (rows.length === 0) throw new Error("no rates in the bulletin");
    for (const row of rows) {
      await db
        .insert(fxRates)
        .values(row)
        .onConflictDoUpdate({ target: [fxRates.marketCode, fxRates.currency], set: { rate: row.rate, fetchedAt: now } });
    }
    cache = null;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** The market config with the latest stored exchange rates applied. */
export async function loadMarket(code?: string): Promise<MarketConfig> {
  const base = getMarket(code);
  if (cache && cache.code === base.code && Date.now() - cache.at < CACHE_MS) return cache.market;

  const stored = await db.select().from(fxRates).where(eq(fxRates.marketCode, base.code));
  const fxRatesNow = { ...base.fxRates };
  for (const row of stored) {
    if (row.currency in fxRatesNow && row.currency !== base.currency) fxRatesNow[row.currency as CurrencyCode] = row.rate;
  }
  const market = { ...base, fxRates: fxRatesNow };
  cache = { code: base.code, at: Date.now(), market };
  return market;
}
