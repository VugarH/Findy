/**
 * Brand-level settings. The name is a working title ("sərfəli" = "good value"
 * in Azerbaijani) — change it here and it updates everywhere.
 */
export const siteConfig = {
  name: "Sərfəli",
  domain: "serfeli.az",
  demoData: process.env.NEXT_PUBLIC_DEMO_DATA !== "false",
} as const;

/**
 * The site's public address, for links that leave the site (Telegram
 * messages). Server only: set SITE_URL, or the domain above is assumed.
 */
export function siteUrl(): string {
  return (process.env.SITE_URL || `https://${siteConfig.domain}`).replace(/\/+$/, "");
}
