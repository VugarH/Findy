import { describe, expect, it } from "vitest";
import { LOCALES, LOCALE_TAGS } from "./config";
import { formatDay, formatNumber, formatWeekday } from "./format";

// Node has complete locale data: our formatting must match it exactly, so pages
// look the same whether the server or the browser wrote them.
describe("locale formatting matches full ICU data", () => {
  it.each(LOCALES)("numbers (%s)", (locale) => {
    for (const value of [0, 7, 1234, 12345.5, 1234567.891, 4889.4, 0.7, -1500]) {
      for (const fraction of [{ min: 0, max: 0 }, { min: 2, max: 2 }, { min: 0, max: 1 }]) {
        const intl = new Intl.NumberFormat(LOCALE_TAGS[locale], { minimumFractionDigits: fraction.min, maximumFractionDigits: fraction.max }).format(value);
        expect(formatNumber(value, locale, { minFraction: fraction.min, maxFraction: fraction.max })).toBe(intl);
      }
    }
  });

  it.each(LOCALES)("days and weekdays (%s)", (locale) => {
    for (let month = 0; month < 12; month++) {
      const day = new Date(Date.UTC(2026, month, 5 + month)).toISOString().slice(0, 10);
      const date = new Date(`${day}T00:00:00Z`);
      for (const style of ["short", "long"] as const) {
        expect(formatDay(day, locale, style)).toBe(
          new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: "numeric", month: style, timeZone: "UTC" }).format(date),
        );
      }
      expect(formatWeekday(day, locale)).toBe(new Intl.DateTimeFormat(LOCALE_TAGS[locale], { weekday: "long", timeZone: "UTC" }).format(date));
    }
  });
});
