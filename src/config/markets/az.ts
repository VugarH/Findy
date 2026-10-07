import type { MarketConfig } from "./types";

/**
 * Azerbaijan.
 *
 * NOTE: the customs numbers are estimates of the personal-parcel rules, and the
 * forwarding rates are typical cargo prices, not quotes. Verify them against
 * customs.gov.az and your forwarder before relying on landed prices.
 * fxRates are only the fallback; the daily job loads official rates from cbar.az.
 */
export const azMarket: MarketConfig = {
  code: "az",
  countryCode: "AZ",
  currency: "AZN",
  defaultLocale: "az",
  locales: ["az", "en", "ru"],
  timeZone: "Asia/Baku",

  fxSource: "cbar",
  fxRates: { AZN: 1, USD: 1.7, EUR: 1.85, GBP: 2.15, TRY: 0.042, CNY: 0.235 },

  customs: {
    dutyFreeThreshold: { amount: 300, currency: "USD" },
    dutyRate: 0.15,
    vatRate: 0.18,
  },

  forwarding: {
    currency: "USD",
    minCharge: 3,
    defaultPerKg: 8,
    perKgByOrigin: { US: 6.5, TR: 2.5, CN: 7, DE: 6, GB: 7 },
    defaultDeliveryDays: { min: 10, max: 18 },
    deliveryDaysByOrigin: {
      TR: { min: 4, max: 8 },
      US: { min: 8, max: 14 },
      DE: { min: 7, max: 12 },
      GB: { min: 8, max: 14 },
      CN: { min: 12, max: 22 },
    },
  },

  foreignPaymentFeeRate: 0.01,

  // PLACEHOLDER PRICING — set the real service fee before offering this to customers.
  assistedOrder: { enabled: true, feeRate: 0.07, minFee: 5, maxQuantity: 5 },

  alerts: { minDropPct: 2, maxWatches: 100 },

  digest: { size: 10, maxPerCategory: 3, maxPerStore: 2, repeatAfterDays: 7 },

  deals: {
    historyWindowDays: 90,
    minHistoryDays: 14,
    minRealDiscountPct: 5,
    showStoreClaims: true,
    staleAfterHours: 48,
    refreshTopSearches: 20,
  },
};
