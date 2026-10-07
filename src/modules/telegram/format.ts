import type { DigestItem } from "@/db/schema";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";
import { flag } from "@/lib/flag";

export { flag };

/**
 * Telegram messages, as HTML (parse_mode "HTML"). Pure: everything the text
 * needs is passed in, so the wording can be tested and previewed in the admin panel.
 */

/** Telegram's limit for one message. */
export const MESSAGE_LIMIT = 4096;

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const link = (url: string, text: string) => `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`;

export function shorten(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export interface MessageContext {
  t: Dictionary;
  money: (amountMinor: number) => string;
  /** Absolute URL of a site path in the message's language: "/top" → "https://serfeli.az/az/top". */
  url: (path: string) => string;
}

export interface DigestPost {
  html: string;
  /** The first deal's photo, shown large above the text. */
  previewUrl?: string;
  button: { text: string; url: string };
}

/** The daily channel post: the day's top deals as a numbered list. */
export function digestPost(items: DigestItem[], day: { label: string; key: string }, ctx: MessageContext): DigestPost {
  const { t } = ctx;
  // Long titles are cut harder until the whole post fits in one message.
  for (const titleLength of [90, 60, 40, 25]) {
    const lines = items.map((item, index) => {
      const discount =
        item.discountPct !== null
          ? ` · −${item.discountPct}%${item.verified ? "" : ` (${escapeHtml(t.telegram.storeClaim)})`}`
          : "";
      const old = item.usualLandedMinor ? ` <s>${escapeHtml(ctx.money(item.usualLandedMinor))}</s>` : "";
      const store = `${flag(item.originCountry)} ${escapeHtml(item.supplierName)}`.trim();
      return (
        `${index + 1}. ${link(ctx.url(`/product/${item.slug}`), shorten(item.title, titleLength))}\n` +
        `<b>${escapeHtml(ctx.money(item.landedMinor))}</b>${old}${discount} · ${store}`
      );
    });
    const html = [
      `🔥 <b>${escapeHtml(fmt(t.telegram.digestTitle, { count: items.length }))}</b>`,
      escapeHtml(day.label),
      "",
      lines.join("\n\n"),
      "",
      `<i>${escapeHtml(t.telegram.digestFooter)}</i>`,
    ].join("\n");
    if (html.length <= MESSAGE_LIMIT) {
      return {
        html,
        previewUrl: items[0]?.imageUrl ?? undefined,
        button: { text: t.telegram.digestButton, url: ctx.url(`/top?day=${day.key}`) },
      };
    }
  }
  throw new Error("The digest does not fit in one Telegram message");
}

export interface DropAlert {
  title: string;
  slug: string;
  store: string;
  oldPriceMinor: number;
  newPriceMinor: number;
  pct: number;
}

/** Most drops listed in one message; the rest are on the site. */
const DROPS_PER_MESSAGE = 8;

/** One person's price drops from one daily run, in one message. */
export function dropAlertMessage(drops: DropAlert[], ctx: MessageContext): string {
  const { t } = ctx;
  const heading =
    drops.length === 1
      ? fmt(t.alerts.pushTitle, { pct: drops[0].pct })
      : fmt(t.telegram.dropsTitle, { count: drops.length });
  const lines = drops.slice(0, DROPS_PER_MESSAGE).map(
    (drop) =>
      `${link(ctx.url(`/product/${drop.slug}`), shorten(drop.title, 90))}\n` +
      escapeHtml(
        fmt(t.alerts.dropLine, {
          pct: drop.pct,
          price: ctx.money(drop.newPriceMinor),
          old: ctx.money(drop.oldPriceMinor),
          store: drop.store,
        }),
      ),
  );
  const more = drops.length - DROPS_PER_MESSAGE;
  return [
    `📉 <b>${escapeHtml(heading)}</b>`,
    "",
    lines.join("\n\n"),
    ...(more > 0 ? ["", escapeHtml(fmt(t.telegram.dropsMore, { count: more }))] : []),
    "",
    link(ctx.url("/alerts"), t.telegram.dropsFooter),
  ].join("\n");
}

export interface NewDealsGroup {
  /** What the person follows: "adidas", "SuperStep", "Shoes". */
  label: string;
  deals: { title: string; slug: string; storeName: string; landedMinor: number; usualLandedMinor: number; discountPct: number }[];
}

/** One person's new deals from what they follow, grouped by brand / store / category. */
export function newDealsMessage(groups: NewDealsGroup[], ctx: MessageContext): string {
  const { t } = ctx;
  const sections = groups.map(
    (group) =>
      `<b>${escapeHtml(group.label)}</b>\n` +
      group.deals
        .map(
          (deal) =>
            `• ${link(ctx.url(`/product/${deal.slug}`), shorten(deal.title, 80))}\n` +
            `  <b>${escapeHtml(ctx.money(deal.landedMinor))}</b> <s>${escapeHtml(ctx.money(deal.usualLandedMinor))}</s>` +
            ` · −${deal.discountPct}% · ${escapeHtml(deal.storeName)}`,
        )
        .join("\n"),
  );
  const html = [`🔔 <b>${escapeHtml(t.follows.telegramTitle)}</b>`, "", sections.join("\n\n"), "", link(ctx.url("/alerts#follows"), t.follows.manage)].join("\n");
  if (html.length <= MESSAGE_LIMIT || groups.length === 0) return html;
  // Unusually long titles: drop the last deal until the message fits (the site lists them all).
  const shorter = groups.map((group, index) =>
    index === groups.length - 1 ? { ...group, deals: group.deals.slice(0, -1) } : group,
  );
  return newDealsMessage(shorter.filter((group) => group.deals.length > 0), ctx);
}
