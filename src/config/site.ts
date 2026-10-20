/**
 * Brand-level settings. Change the name here and it updates everywhere.
 * (Browser storage keys and the analytics salt still say "serfeli", the old
 * working title: renaming them would empty carts and reset visitor counts.)
 */
export const siteConfig = {
  name: "Findy",
  /** Only a fallback: production sets SITE_URL. */
  domain: "findy.az",
  /**
   * Sample stores and prices instead of the real ones — only when switched on
   * explicitly, so a deployment or a scheduled job that lacks the setting
   * never fills the live database with demo data.
   */
  demoData: process.env.NEXT_PUBLIC_DEMO_DATA?.trim().toLowerCase() === "true",
} as const;

/**
 * The site's public address, for links that leave the site (Telegram
 * messages). Server only: set SITE_URL, or the domain above is assumed.
 */
export function siteUrl(): string {
  return (process.env.SITE_URL || `https://${siteConfig.domain}`).replace(/\/+$/, "");
}
