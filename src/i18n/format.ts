import type { Locale } from "./config";

/** Fills {placeholders} in a dictionary string. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

/** Prefixes an app path with the locale: ("en", "/deals") -> "/en/deals". */
export function localePath(locale: Locale, path: string = "/"): string {
  return `/${locale}${path === "/" ? "" : path}`;
}
