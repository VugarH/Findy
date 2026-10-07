import { LOCALE_TAGS, type Locale } from "@/i18n/config";
import { getAdminDictionary, type AdminDictionary } from "@/i18n/dictionaries/admin";
import { getI18n, type I18n } from "@/i18n/server";

export interface AdminI18n extends I18n {
  /** The admin panel's own text. */
  a: AdminDictionary;
  /** "6 Oct 2026, 14:07" in the admin's language. */
  dateTime: (date: Date | null | undefined) => string;
  date: (date: Date | null | undefined) => string;
  /** 12 345 in the admin's language. */
  num: (value: number) => string;
}

export function dateFormatters(locale: Locale) {
  const dateTime = new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Baku",
  });
  const date = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { dateStyle: "medium", timeZone: "Asia/Baku" });
  const number = new Intl.NumberFormat(LOCALE_TAGS[locale]);
  return {
    num: (value: number) => number.format(value),
    dateTime: (value: Date | null | undefined) => (value ? dateTime.format(value) : "—"),
    date: (value: Date | null | undefined) => (value ? date.format(value) : "—"),
  };
}

/** The site's i18n plus the admin dictionary and date formatting. Admin Server Components only. */
export async function getAdminI18n(): Promise<AdminI18n> {
  const i18n = await getI18n();
  return { ...i18n, a: getAdminDictionary(i18n.locale), ...dateFormatters(i18n.locale) };
}
