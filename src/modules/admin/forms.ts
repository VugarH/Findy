import type { z } from "zod";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import type { StorePreview } from "@/modules/suppliers/custom";

/**
 * Shared plumbing for the admin forms. Validation messages are keys under
 * `admin.errors` in the dictionaries, so forms show them in the admin's language.
 */
export type AdminErrorKey =
  | "required"
  | "tooLong"
  | "invalid"
  | "invalidUrl"
  | "invalidPrice"
  | "invalidPattern"
  | "invalidCountry"
  | "listBelowPrice"
  | "chooseCategory"
  | "productExists"
  | "notFound"
  | "mergeSame"
  | "mergeTargetMerged"
  | "noSelection"
  | "ownRole"
  | "notEditable"
  | "noDeals"
  | "alreadyPosted"
  | "telegramFailed"
  | "telegramOff"
  | "unexpected";

export type AdminNoticeKey =
  | "saved"
  | "created"
  | "published"
  | "collecting"
  | "bulkDone"
  | "merged"
  | "previewOk"
  | "digestPicked"
  | "digestPosted";

export interface AdminFormState {
  /** Error per field. */
  errors?: Record<string, AdminErrorKey>;
  /** An error that is not about one field. */
  formError?: AdminErrorKey;
  notice?: AdminNoticeKey;
  /** Numbers for the notice text ({count}). */
  noticeVars?: Record<string, string | number>;
  /** What was typed, so a failed submit does not wipe the form. */
  values?: Record<string, string>;
  /** "Test connection" on the store form: what a run would save. */
  preview?: StorePreview;
}

export const text = (form: FormData, name: string): string => String(form.get(name) ?? "").trim();

export const checked = (form: FormData, name: string): boolean => form.get(name) === "on";

export function localeOf(form: FormData): Locale {
  const value = text(form, "locale");
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Every text field of a form, for re-filling it after an error. */
export function formValues(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string" && !key.startsWith("$"))
      values[key] = key in values ? `${values[key]},${value}` : value;
  }
  return values;
}

/** First error per field, as dictionary keys. Nested paths are joined with dots ("connection.sitemap"). */
export function fieldErrors(error: z.ZodError): Record<string, AdminErrorKey> {
  const result: Record<string, AdminErrorKey> = {};
  for (const issue of error.issues) {
    const field = issue.path.map(String).join(".") || "form";
    result[field] ??= (isErrorKey(issue.message) ? issue.message : "invalid") as AdminErrorKey;
  }
  return result;
}

const ERROR_KEYS = new Set<string>([
  "required",
  "tooLong",
  "invalid",
  "invalidUrl",
  "invalidPrice",
  "invalidPattern",
  "invalidCountry",
  "listBelowPrice",
  "chooseCategory",
]);
const isErrorKey = (value: string) => ERROR_KEYS.has(value);

/**
 * An amount typed by a person, in minor units: "129", "129.90", "129,90",
 * "1 299,90", "1.299,90", "1,299.90". Null when it is not an amount.
 */
export function parseAmountToMinor(input: string): number | null {
  const value = input.replace(/[\s ₼$€£₺¥]/g, "");
  if (!/^\d[\d.,]*$/.test(value)) return null;
  const lastSeparator = Math.max(value.lastIndexOf(","), value.lastIndexOf("."));
  const decimals = lastSeparator >= 0 ? value.length - lastSeparator - 1 : 0;
  // A separator followed by one or two digits is the decimal point; three digits is thousands.
  const [whole, fraction] =
    lastSeparator >= 0 && decimals <= 2 ? [value.slice(0, lastSeparator), value.slice(lastSeparator + 1)] : [value, ""];
  // The whole part is plain digits, or digits in groups of three ("1.299", "12,500,000").
  if (!/^\d+$/.test(whole) && !/^\d{1,3}([.,]\d{3})+$/.test(whole)) return null;
  const minor = Number(whole.replace(/[.,]/g, "")) * 100 + Number(fraction.padEnd(2, "0") || 0);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

/** Minor units back to what a person would type ("129.90"), for pre-filling forms. */
export const minorToInput = (minor: number | null | undefined): string =>
  minor == null ? "" : (minor / 100).toFixed(2).replace(/\.00$/, "");

export type SearchParams = Record<string, string | string[] | undefined>;

/** One value of a page's search params (the first, when repeated), trimmed; "" when absent. */
export function param(params: SearchParams, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** A page number from the search params, at least 1. */
export function pageParam(params: SearchParams): number {
  const page = Number(param(params, "page"));
  return Number.isInteger(page) && page > 1 ? page : 1;
}

/** "?a=1&b=2" from the non-empty values, for links that keep the current filters. */
export function queryString(values: Record<string, string | number | undefined | null | false>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== false && value !== "") query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}
