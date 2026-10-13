import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/site";

export const dynamic = "force-dynamic";

/**
 * Search engines may read the public pages. Private and endless pages are left
 * out: the admin panel, accounts and messages, the cart, search results (every
 * query is a new page) and our click-out links.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/go/", "/*/admin", "/*/account", "/*/messages", "/*/alerts", "/*/cart", "/*/search", "/*/login", "/*/register", "/*/product/*/order"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
