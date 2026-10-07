import type { CurrencyCode } from "@/config/currencies";
import type { Locale } from "@/i18n/config";

/**
 * Everything that differs from country to country lives in a MarketConfig.
 * Launching a new country = adding one file next to az.ts and registering it
 * in ./index.ts. No pricing or deal logic should hard-code a country.
 */
export interface MarketConfig {
  code: string;
  countryCode: string;
  currency: CurrencyCode;
  defaultLocale: Locale;
  locales: readonly Locale[];
  /** IANA time zone; decides when the market's day starts (the daily top deals). */
  timeZone: string;

  /** How many units of the market currency one unit of each currency buys. */
  fxRates: Record<CurrencyCode, number>;
  /** Where live rates come from; without it the static fxRates above are used. */
  fxSource?: "cbar";

  /** Import rules for parcels ordered from abroad for personal use. */
  customs: {
    dutyFreeThreshold: { amount: number; currency: CurrencyCode };
    /** Customs duty, applied to the value above the threshold. */
    dutyRate: number;
    /** VAT, applied to (value above the threshold + duty). */
    vatRate: number;
  };

  /** Freight-forwarder estimate, used when a foreign store has no direct shipping price. */
  forwarding: {
    currency: CurrencyCode;
    minCharge: number;
    defaultPerKg: number;
    perKgByOrigin: Record<string, number>;
    defaultDeliveryDays: { min: number; max: number };
    deliveryDaysByOrigin: Record<string, { min: number; max: number }>;
  };

  /** Bank / card mark-up when paying in a foreign currency. */
  foreignPaymentFeeRate: number;

  /**
   * "We order it for you": for people who do not want to deal with a foreign
   * store, a forwarder and customs themselves. The fee is charged on the landed total.
   */
  assistedOrder: {
    enabled: boolean;
    /** Share of the landed total, e.g. 0.07 = 7%. */
    feeRate: number;
    /** Smallest fee, in whole units of the market currency. */
    minFee: number;
    maxQuantity: number;
  };

  alerts: {
    /**
     * Smallest fall in the landed price worth a notification. Guards against
     * noise from exchange rates moving a foreign price by a fraction of a percent.
     */
    minDropPct: number;
    /** Most products one person may watch. */
    maxWatches: number;
  };

  /** The day's top deals: shown on the site and posted to the Telegram channel. */
  digest: {
    size: number;
    /** At most this many from one category and one store, so the list is varied. */
    maxPerCategory: number;
    maxPerStore: number;
    /** A product is not picked again within this many days, unless there are too few others. */
    repeatAfterDays: number;
  };

  deals: {
    /** How far back the "usual price" looks. */
    historyWindowDays: number;
    /** Offers with less history than this are never published as deals. */
    minHistoryDays: number;
    /** Minimum verified discount against the usual price. */
    minRealDiscountPct: number;
    /**
     * While an offer has too little history to verify, publish the store's own
     * advertised discount, clearly labelled as unverified and ranked lower.
     */
    showStoreClaims: boolean;
    /** Offers not re-seen within this window are treated as gone. */
    staleAfterHours: number;
    /** How many popular user searches the daily job refreshes. */
    refreshTopSearches: number;
  };
}
