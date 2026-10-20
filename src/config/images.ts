/**
 * Product photos we can show. Some image servers refuse to be shown on other
 * sites ("hotlink protection") and answer with a "not found" picture instead.
 * We respect that rather than working around it, so their photos count as
 * missing — and a product without a usable photo is left out of deal lists
 * and search (its own page still opens from a direct link).
 */
const HOTLINK_PROTECTED_HOSTS = [
  // Fakir (fakir.com.tr)
  "witcdn.net",
];
/** WitCDN also serves stores from their own subdomain (witcdn.dermoeczanem.com), with the same protection. */
const HOTLINK_PROTECTED_PREFIXES = ["witcdn."];

/** The photo address if it can be shown on our pages, else null. */
export function usableImage(url: string | null | undefined): string | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  const blocked =
    HOTLINK_PROTECTED_HOSTS.some((name) => host === name || host.endsWith(`.${name}`)) ||
    HOTLINK_PROTECTED_PREFIXES.some((prefix) => host.startsWith(prefix));
  return blocked ? null : url;
}
