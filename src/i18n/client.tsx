"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { CurrencyCode } from "@/config/currencies";
import { formatMoney } from "@/lib/money";
import type { Locale } from "./config";
import type { Dictionary } from "./dictionaries";
import { localePath } from "./format";

interface I18nContextValue {
  locale: Locale;
  t: Dictionary;
  currency: CurrencyCode;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children, ...value }: I18nContextValue & { children: ReactNode }) {
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Client-side counterpart of getI18n(). */
export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return useMemo(
    () => ({
      ...value,
      money: (amountMinor: number, currency: CurrencyCode = value.currency) =>
        formatMoney(amountMinor, currency, value.locale),
      href: (path?: string) => localePath(value.locale, path),
    }),
    [value],
  );
}
