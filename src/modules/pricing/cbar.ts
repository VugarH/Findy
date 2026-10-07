import { CURRENCIES, type CurrencyCode } from "@/config/currencies";

/** Official rates of the Central Bank of Azerbaijan: AZN per one unit of each currency. */
export function parseCbarRates(xml: string): Partial<Record<CurrencyCode, number>> {
  const rates: Partial<Record<CurrencyCode, number>> = {};
  for (const match of xml.matchAll(/<Valute Code="([A-Z]{3})">\s*<Nominal>([^<]*)<\/Nominal>[\s\S]*?<Value>([\d.]+)<\/Value>/g)) {
    const [, code, nominal, value] = match;
    const units = parseFloat(nominal);
    if (code in CURRENCIES && units > 0 && Number(value) > 0) rates[code as CurrencyCode] = Number(value) / units;
  }
  return rates;
}
