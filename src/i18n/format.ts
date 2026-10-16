import type { Locale } from "./config";

/** Fills {placeholders} in a dictionary string. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

/** Prefixes an app path with the locale: ("en", "/deals") -> "/en/deals". */
export function localePath(locale: Locale, path: string = "/"): string {
  return `/${locale}${path === "/" ? "" : path}`;
}

/*
 * Numbers and dates written the same way on the server and in every browser.
 * Browsers ship incomplete data for Azerbaijani (Chrome writes "M10 15" and
 * "41.25"), so a page formatted in the browser would differ from the server's
 * and from Node's full data. These match Node's output (see format.test.ts).
 */

const SEPARATORS: Record<Locale, { group: string; decimal: string }> = {
  az: { group: ".", decimal: "," },
  en: { group: ",", decimal: "." },
  ru: { group: " ", decimal: "," },
};

/** 1234567.5 → "1.234.567,5" (az), "1 234 567,5" (ru), "1,234,567.5" (en). */
export function formatNumber(value: number, locale: Locale, { minFraction = 0, maxFraction = 0 } = {}): string {
  const { group, decimal } = SEPARATORS[locale];
  const factor = 10 ** maxFraction;
  const rounded = Math.round(Math.abs(value) * factor) / factor;
  let [whole, fraction = ""] = rounded.toFixed(maxFraction).split(".");
  fraction = fraction.replace(/0+$/, "").padEnd(minFraction, "0");
  whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return `${value < 0 && rounded !== 0 ? "-" : ""}${whole}${fraction ? decimal + fraction : ""}`;
}

const MONTHS: Record<Locale, { short: string[]; long: string[] }> = {
  az: {
    short: ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"],
    long: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"],
  },
  en: {
    short: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"],
    long: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  },
  ru: {
    short: ["янв.", "февр.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."],
    long: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
  },
};

const WEEKDAYS: Record<Locale, string[]> = {
  az: ["bazar", "bazar ertəsi", "çərşənbə axşamı", "çərşənbə", "cümə axşamı", "cümə", "şənbə"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  ru: ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"],
};

/** A calendar day (YYYY-MM-DD) as "15 okt" / "15 oktyabr"; no time zone involved. */
export function formatDay(day: string, locale: Locale, month: "short" | "long" = "short"): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[locale][month][m - 1]}`;
}

/** The weekday of a calendar day (YYYY-MM-DD), e.g. "çərşənbə axşamı". */
export function formatWeekday(day: string, locale: Locale): string {
  return WEEKDAYS[locale][new Date(`${day}T12:00:00Z`).getUTCDay()];
}
