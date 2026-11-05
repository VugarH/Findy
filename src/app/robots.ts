import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/site";

export const dynamic = "force-dynamic";

/** Private pages, pages with no value in search results, and endless variants. */
const PRIVATE = ["/api/", "/go/", "/*/admin", "/*/account", "/*/messages", "/*/alerts", "/*/cart", "/*/search", "/*/login", "/*/register", "/*/forgot-password", "/*/reset-password", "/*/verify-email", "/*/product/*/order"];

/**
 * Every page has one address without a query: filters, sorting and paging
 * (?brand=…&sort=…&page=…) make endless copies of the same lists, and "find it
 * elsewhere" (/product/…/similar) runs a search per visit. Search engines find
 * every product and category through the sitemap and plain links.
 */
const VARIANTS = ["/*?", "/*/product/*/similar"];

/**
 * Crawlers that collect pages to train AI models. They send no visitors, and
 * they read the whole catalog over and over (GPTBot alone 80,000 pages in
 * 12 hours), which uses up the hosting and database allowances. Assistants that
 * fetch a page for a person asking (OAI-SearchBot, ChatGPT-User, Perplexity) stay allowed.
 */
const AI_TRAINING = ["GPTBot", "ClaudeBot", "anthropic-ai", "CCBot", "Google-Extended", "Bytespider", "Applebot-Extended", "meta-externalagent", "Amazonbot", "cohere-ai", "Diffbot", "omgili", "Timpibot", "ImagesiftBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_TRAINING, disallow: "/" },
      { userAgent: "*", allow: "/", disallow: [...PRIVATE, ...VARIANTS] },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
