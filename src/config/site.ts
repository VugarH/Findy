/**
 * Brand-level settings. The name is a working title ("sərfəli" = "good value"
 * in Azerbaijani) — change it here and it updates everywhere.
 */
export const siteConfig = {
  name: "Sərfəli",
  domain: "serfeli.az",
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
