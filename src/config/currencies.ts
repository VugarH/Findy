export const CURRENCIES = {
  AZN: { symbol: "₼", symbolFirst: false },
  USD: { symbol: "$", symbolFirst: true },
  EUR: { symbol: "€", symbolFirst: true },
  GBP: { symbol: "£", symbolFirst: true },
  TRY: { symbol: "₺", symbolFirst: true },
  CNY: { symbol: "¥", symbolFirst: true },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export function isCurrencyCode(value: string): value is CurrencyCode {
  return value in CURRENCIES;
}
