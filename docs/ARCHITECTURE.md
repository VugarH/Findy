# Architecture

## The idea in one paragraph

A daily job collects prices from every supplier, matches listings to products, stores a price
observation per offer per day, and publishes only the products whose best offer is a *verified*
discount against its own history. Users browse that pre-computed catalog; when it has no answer,
a live search asks every supplier at once and streams results back. Whatever a live search finds
is saved, and popular searches are refreshed by the daily job — so the catalog grows toward what
people actually look for.

```
Daily job ─► suppliers ─► ingest ─► offers + price history ─► deals (published)
                            ▲                                    │
User search ─► catalog ─► (nothing?) ─► live search ─────────────┘  home / deals / product pages
```

## Layout

```
src/
  config/            site name, currencies, categories, one file per market
  i18n/              locales (az, en, ru), dictionaries, server + client helpers
  db/                Drizzle schema, client, SQL migrations
  modules/           business logic — no React in here
    suppliers/       SupplierAdapter contract, registry, adapters/
    catalog/         matching, ingest, offer views, product summary
    pricing/         landed cost (pure)
    deals/           discount verification, scoring, pipeline, queries
    search/          catalog search, live search
    admin/           the admin panel's services, form validation, activity log, Server Actions (actions/)
    alerts/          price watches, notifications, browser push
    digest/          the day's top deals (pick.ts is pure)
    cart/            the cart priced as parcels, one per store (plan.ts is pure)
    follows/         follow a brand, store or category; the daily new-deals job (match.ts is pure)
    telegram/        Bot API client, channel post, account linking, bot commands
  components/        ui/ (primitives), layout/, deals/, product/, search/, admin/, alerts/, notifications/, cart/
  app/
    [lang]/(site)/   public pages: home, deals, category/[slug], product/[slug], search…
    [lang]/admin/    the admin panel: stores, products, categories, orders, runs, telegram, activity, users
    api/             search/live (SSE), cron/daily-deals, telegram/webhook
    go/[offerId]     click-out redirect (affiliate tracking point)
scripts/             seed.ts, run-daily-deals.ts, telegram.ts, admin.ts…
```

Rules that keep it extensible:

- **Pages are thin.** They call `modules/*` and render components. Logic never lives in a page.
- **`modules/` never imports from `components/` or `app/`.**
- **One decision, one place.** "Is this a deal?" is `catalog/summary.ts`. "What does it cost?" is
  `pricing/landed-cost.ts`. The daily job, search and product page all call the same functions.
- **Money is integer minor units** (qəpik/cents) everywhere.
- **Nothing hard-codes a country.** Anything country-specific is in `config/markets/<code>.ts`.

## How to add things

**A supplier** — create `src/modules/suppliers/adapters/<store>.ts` implementing `SupplierAdapter`
(`fetchCatalog` for the daily job, `search` for live search), add it to `registry.ts`. Nothing
else changes. Every adapter carries an `access` record: the method, the steps, where each field
comes from, what robots.txt allows, and the request limits. The first time the store returns real
offers, it is written to the `suppliers` table with its link and that record
(`npm run suppliers:list` prints it), and every run updates its last-success / last-error.
Use `PoliteClient` (`suppliers/http.ts`) for all requests. Research notes: `docs/SUPPLIERS.md`.

**A Shopify-based store** — one entry in `suppliers/adapters/shopify/stores.ts`; no new code.
A store that sells several categories names its main one in `category` and the others in
`mixedWith`; each product is placed by the words in its title and product type.

**A store with a sitemap and schema.org product data** (most large Turkish retailers) — one entry
in `suppliers/adapters/structured-data/stores.ts`: the sitemap, a pattern for product URLs, the
categories it sells, and where its crossed-out price is (`listPrice`). Check the store first with
`npm run store:probe -- www.example.com.tr`: it reads robots.txt, the sitemap and three product
pages exactly as the adapter would, and reports which crossed-out-price source matches. The adapter reads up to 300 product pages
per run, one every 1.5 s, and the same pages every day (focus brands first, then the most recently
changed): an offer not re-confirmed within `staleAfterHours` (48 h) is hidden everywhere, so a
product the job reads only once would vanish two days later.

**A product type** — stores name products differently, so each type needs a title normaliser
(`catalog/normalizers/phones.ts` is the first). It turns a store title into brand + model, which
is what makes the same product from two stores land on one page. For clothing and shoes the key
is the maker's article number (adidas "IH2639", Nike "FN8797-456"): add a brand's format to
`ARTICLE_FORMATS` in `catalog/normalizers/fashion.ts`.

**A category** — add it to `config/categories.ts` (with its words in `CATEGORY_HINTS` if
multi-category stores sell it), give it subcategory rules in `config/subcategories.ts`, add its
name to each dictionary, a `--cat-<slug>` colour in `globals.css` and `CATEGORY_TEXT`, and an icon
in `components/ui/category-icon.tsx`. TypeScript flags every missed spot. Keyword rules match
titles folded to plain ASCII (`lib/text.ts`), so write "canta", not "çanta".

**Switching a store or product off** — in the admin panel (one button on the store's or product's
page, or tick many products and "Switch off"), or from the command line: `npm run status -- store
<id> off` / `npm run status -- product <slug> off`. A switched-off store is not contacted by the
daily job; a switched-off product is hidden everywhere (its page answers "not found") and its
prices are no longer recorded.

**Who a product is for** (women / men / kids / unisex) — `config/audience.ts` reads it from the
title; the daily job re-tags every product, and the "For" filter appears wherever products carry it.

**A search word in another language** — add a group to `search/synonyms.ts` ("krossovka",
"кроссовки" → "sneaker", "spor ayakkab"). Catalog search matches titles folded to plain ASCII.

**A subcategory** — add a rule to `config/subcategories.ts` and its name to each dictionary, then
`npm run deals:rebuild`. Products are re-sorted by the current rules on every run, so changing a
rule also fixes products already in the database.

**A country** — add `config/markets/<code>.ts` (currency, FX, customs rules, forwarding rates),
register it in `config/markets/index.ts`, deploy with `MARKET=<code>`.

**A language** — add the code to `i18n/config.ts` and a dictionary file; the `Dictionary` type
makes missing keys a compile error.

**A deal signal** — extend `DealSignals` and the weights in `deals/scoring.ts`.

**Smarter matching** (LLM / embeddings for listings without GTIN or model) — `catalog/matching.ts`.

## Data model

| Table | Purpose |
|---|---|
| `suppliers` | Stores that have returned real data or were added in the admin panel: link, access method, last success / error, on/off, team notes; `custom_config` for panel stores |
| `products` | One row per real product, shared across suppliers (matched by GTIN, then brand + article number, then brand+model); carries its subcategory, the fields set by hand (`locked_fields`) and, for a merged duplicate, `merged_into_id` |
| `offers` | A supplier's current listing of a product (`manual` when entered in the admin panel) |
| `price_observations` | One price per offer per day — the basis of discount verification |
| `deals` | Published deal catalog per market, rebuilt atomically by each run |
| `pipeline_runs` | Run log with per-supplier success/failure |
| `search_queries` | What users search; drives which products the job refreshes |
| `order_requests` | "Order it for me" requests for items from abroad, with the estimate shown at the time |
| `price_watches`, `notifications`, `push_subscriptions` | Price alerts: what is watched, what was sent, which browsers receive push |
| `users`, `sessions` | Accounts (with their role: user / admin, and the connected Telegram chat) and signed-in browsers |
| `follows`, `follow_runs` | What people follow, and each run of the new-deals job (its time window) |
| `daily_digests` | The day's top deals per market (a snapshot), and whether / when they were posted to Telegram |
| `telegram_link_tokens` | One-time start links that connect an account to the Telegram bot (hashed) |
| `admin_events` | The admin panel's activity log; also tells which changes still need publishing |
| `outbound_clicks` | Click-outs to stores, for affiliate/sponsored reporting |

## Finding the same item in other stores

Exact matches are merged into one product when offers are ingested. For items that stores name
too differently for that, the product page links to `/product/{slug}/similar`, which ranks
products in the same category by name similarity (PostgreSQL `pg_trgm`). A result is labelled
"most likely the same item" only if the names also agree on every number and variant word
(`catalog/similar.ts`), because "Honor 600" and "Honor 600 Pro" are otherwise almost identical
strings. When a store with an official search API is connected, the same page also queries it
live.

## Admin panel

`app/[lang]/admin` (pages) + `modules/admin` (everything else) + `components/admin` (forms and
building blocks). Only accounts with `users.role = 'admin'` get in (`npm run admin -- grant <email>`
for the first one); to everyone else the panel answers 404. Pages call `requireAdminPage()`; every
Server Action calls `requireAdmin()` itself, because actions can be posted to directly.

What it does, and where the rules live:

- **Stores** (`admin/stores.ts`) — every store in the code plus the ones added in the panel, with
  status (fine / failing / not collected yet / off), offers on the site, recent runs, how the store
  is read, team notes, on/off and "Collect now" (runs the pipeline for that one store after the
  response, with `after()`).
- **Stores added in the panel** (`suppliers/custom.ts`, settings in `suppliers.custom_config`,
  validated by `suppliers/custom-config.ts`) — one of the generic connectors the code stores use:
  Shopify, sitemap + schema.org product data, or **prices by hand** (no connector). "Test
  connection" runs the connector once without saving. `getAllAdapters()` gives the daily job the
  code stores plus these. A new connector type: a schema entry in `custom-config.ts` and a case in
  `createCustomAdapter`.
- **Products** (`admin/products.ts`) — list with filters and bulk actions (move to a category /
  subcategory, set who it is for, switch on/off), product page with edit, offers, merge, history.
- **Fields set by hand are locked** (`products.locked_fields`, `catalog/locks.ts`,
  `catalog/placement.ts`): the daily job's subcategory and audience rules skip a locked field, so a
  correction is never undone overnight. Choosing "Automatic" hands the field back to the rules.
- **Prices entered by hand** (`catalog/manual-offers.ts`, `offers.manual`) — for a shop without a
  usable website, or an item a crawler does not reach. The daily job re-confirms them every day
  (price history and freshness), until someone changes or removes them.
- **Merging duplicates** (`catalog/merge.ts`) — the duplicate's offers, watches and order requests
  move to the product that stays; the duplicate is kept switched off with `merged_into_id`, so
  ingest keeps sending that store's listing to the right product and its old address redirects.
- **Products added by hand** — created with the same match keys a store listing would produce, so
  a store that starts selling the item later adds its offer to it instead of a duplicate.
- **Categories** — the tree with product counts per subcategory; categories and their rules stay
  in code (names in three languages, icon, rules), products are moved in the panel.
- **Order requests**, **daily runs**, **users** (roles) and the **activity log** (`admin_events`,
  `admin/audit.ts`: who changed what, when).

**Publishing.** Moving or switching off a product changes the published deals at once
(`deals/publish.ts`). Changes that can change which offer wins — a price entered by hand, a store
switched back on, a merge — are marked `needs_publish` in the activity log; the bar at the top of
every admin page counts them and "Publish changes" rebuilds the deals (a few seconds).

**Adding to the panel.** A new section: a folder under `app/[lang]/admin`, its service in
`modules/admin`, its actions in `modules/admin/actions`, a menu entry in
`components/admin/admin-nav.tsx`, and its text in `i18n/dictionaries/admin/{en,az,ru}.ts` (the
panel's own dictionary, loaded only by the admin layout). A new kind of logged change: its name in
`ADMIN_ACTIONS` (`admin/audit.ts`) and a label under `activity.actions`.

## Accounts

`modules/auth` — email + password, no third-party service. Passwords are hashed with scrypt
(`password.ts`); a sign-in creates a row in `sessions` and an httpOnly cookie holding a random
token, of which only the SHA-256 hash is stored. Forms post to Server Actions (`actions.ts`), which
validate with the zod schemas in `validation.ts` and return error *keys* that the dictionaries
translate. `getCurrentUser()` is the only way pages learn who is signed in.

Not built yet, because each needs an email provider: confirming the email address and "forgot
password". The sign-in rate limit is in memory, so it covers one server process.

## Assisted ordering ("we order it for you")

`modules/orders`. For any in-stock offer from abroad, the product page shows what it would cost
to have us buy and ship it (`estimateAssistedOrder`: landed cost for the quantity as one parcel,
plus the service fee from `assistedOrder` in the market config). The form at
`/product/{slug}/order` saves a row in `order_requests` — a *request*, not an order: nothing is
charged, and someone confirms the final price by phone first. `npm run orders:list` prints the
requests; signed-in users see theirs on the account page.

The admin panel's Order requests page lists them and changes their status. Not built: taking
payment, and notifying anyone when a request arrives.

## Price alerts

`modules/alerts`. A signed-in person taps the bell on any product (`price_watches`). At the end of
every daily run, `checkPriceWatches` compares each watched product's best landed price with the
price at the previous check; a fall of at least `alerts.minDropPct` creates a row in
`notifications` (listed under the header bell and at `/alerts`), a Web Push message to every
browser that person has enabled (`push_subscriptions`, `public/sw.js`) and, when they connected
Telegram, one Telegram message with all of their drops. `npm run alerts:check` runs the check on
its own.

Push needs the three `VAPID_*` values in `.env`; Telegram needs `TELEGRAM_BOT_TOKEN`. Without
them notifications still appear on the site. Email is not connected.

The header bell (`components/notifications/notification-bell.tsx`) is for everyone: it announces
the day's top deals and, for signed-in people, lists their latest notifications (fetched when it
opens; opening it marks them read).

## Following brands, stores and categories

`modules/follows`. A signed-in person follows a brand (`brandKey`), a store (supplier id) or a
category (slug) with the Follow buttons on product, category, deals (one brand filtered) and
stores pages; the list is on `/alerts#follows`.

`deals.deal_since` is when a product became a deal: `buildDeals` keeps it while the product stays
a deal, so only genuinely new deals get a recent time. `npm run follows:notify` (meant for 10:00,
or `POST /api/cron/follows` with `CRON_SECRET`) takes the deals that started since its previous
run (`follow_runs.window_end`) and after each follow began, picks the best per follow
(`match.ts`: at most 5 per follow, 15 per person, a product and its colour variants once) and
writes `new_deal` notifications (under the bell) plus one Telegram message per connected person.
Running it twice sends nothing new; a skipped day is covered by the next run. A deal that ends
and comes back later counts as new again.

## Sizes

`suppliers/sizes.ts` reads the sizes a store lists, and which are in stock, from data the daily
job already downloads: Shopify's product options (the option named like "Size"/"Beden"),
schema.org ProductGroup variants with a `size`, and the variant list that Akinon-based Turkish
stores (SuperStep and others) embed in their product pages. Lists are cleaned and put in size
order (XXS…4XL, numbers ascending); "one size" is dropped. They are saved per offer
(`offers.sizes`, null = unknown) and shown on the product page: "Find your size" (pick a size,
see which stores have it, cheapest first), each store panel and the offers table. A store whose
pages carry none of these simply shows no sizes.

The deal lists of categories sold by size (`SIZED_CATEGORIES`: clothing, shoes, sports, baby) and
the search results within them have a size filter (`?sizes=42,42.5`). `buildDeals` stores the
sizes in stock at each deal's store in `deals.sizes`, spelled one way across stores (`sizeKey`:
"42,5" → "42.5", "2XL" → "XXL"); the filter keeps deals with any chosen size. Deals whose store
lists no sizes are left out while a size is chosen, so the size filter starts switched off.

Admins switch each deal-list filter on or off in the panel (Settings → Deal filters;
`modules/settings`, stored in `site_settings`). A switched-off filter is not drawn by
`FilterSidebar`, and `parseDealFilters` ignores its URL parameter, so old links still work. A new
site-wide setting = a key in `modules/settings/service.ts` and a panel on the Settings page.

## Cart and parcel planner

The cart lives in the visitor's browser (`components/cart/cart-store.ts`, localStorage), so it
needs no account and adding an item never reloads the page; it holds store listings (offer ids)
and quantities. The cart page sends it to `priceCartAction`, which prices it with today's offers
(`modules/cart/service.ts`) and splits it into parcels, one per store (`modules/cart/plan.ts`).

A parcel is priced as a whole by `computeParcelCost` (`pricing/landed-cost.ts`, which
`computeLandedCost` also uses for one item): one delivery charge (the forwarder bills the total
weight, with its minimum once; a store that ships itself charges once per order) and customs on
the parcel's total value, so items under the duty-free limit on their own can cross it together.
Each parcel shows how much room is left under the limit, or how far over it is; what combining
saves against ordering each item separately; and its delivery time (the slowest item). Listings
that are gone or out of stock are listed apart, with the product's best offer elsewhere.

Not built yet: saving the cart to the account (it is per browser), and "order this parcel for
me" (assisted orders take one product).

## Daily top deals and Telegram

At the end of a full daily run (not "Collect now" for one store) `modules/digest` picks the day's
top deals from the published deals: best score first, verified discounts preferred, at most
`digest.maxPerCategory` / `maxPerStore` each, nothing picked in the last `repeatAfterDays`
(market config). It is stored once per market day (`daily_digests`, in the market's `timeZone`),
shown at `/top` and posted to the Telegram channel by `modules/telegram/channel.ts`; a second run
the same day changes nothing.

`modules/telegram`: `api.ts` is a small Bot API client; `format.ts` writes every message (pure, so
it is tested and previewed in the admin panel); `link.ts` connects accounts — the site makes a
one-time `t.me/<bot>?start=<token>` link, and the bot (`bot.ts`) receives the token when Start is
pressed. Messages to the bot arrive at `/api/telegram/webhook` when `TELEGRAM_WEBHOOK_SECRET` is
set, otherwise the site fetches them (`updates.ts`) while someone waits on "Connect Telegram", or
`npm run telegram -- listen` does. A person who blocks the bot, or sends /stop, is disconnected.

To post something new to the channel: write its text in `format.ts` (with its strings in the
`telegram` section of each dictionary) and send it with `sendMessage` from `api.ts`.

## What counts as a deal

For each product the cheapest in-stock offer by **landed cost** is the candidate. It is published
only if its price is at least `minRealDiscountPct` below the median of its own last
`historyWindowDays`, with at least `minHistoryDays` of history. A supplier's crossed-out "was"
price is never trusted; when it is far above what history supports, the product page says so.

While an offer has less than `minHistoryDays` of history, the store's own advertised discount is
shown instead, labelled "not verified yet" and ranked lower (`showStoreClaims` in the market
config). As history accumulates these turn into verified deals or disappear.

## Before real launch

- **Verify the Azerbaijan customs numbers and forwarder rates** in `config/markets/az.ts`.
  Exchange rates are already live: the daily job loads the official cbar.az bulletin.
- Set `BOT_CONTACT` so stores can reach you, and introduce the service to the connected stores.
- Schedule `npm run deals:run` daily — discounts can only be verified from history we collect.
- Rate-limit `/api/search/live`.
- Move the pipeline to a queue with one worker per supplier once there are many suppliers.
- Replace `ILIKE` catalog search with `pg_trgm` or a search engine as the catalog grows.

## Roadmap status

1. Foundation — done
2. Deals MVP (daily job, verification, scoring, deal pages, price history) — done; real data from
   two Azerbaijani stores (smartphones)
3. Live search (catalog first, streamed web search, landed cost) — built; waits for a store with
   an official API (needs your developer/affiliate accounts)
4. Retention — accounts, price alerts (site, browser push, Telegram), daily top deals on the site
   and in a Telegram channel — done; email not connected
5. Growth — SEO pages, browser extension, merchant dashboard, sponsored slots
6. Buy-on-behalf
