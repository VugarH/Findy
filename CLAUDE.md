@AGENTS.md

# Findy — project guide

Azerbaijan-first deal finder. A daily job reads ~180 stores (Shopify JSON, Turkish sitemap +
schema.org stores, 3 AZ stores), computes the landed price in AZN (item + delivery + customs +
fees), verifies discounts against our own price history and publishes deals in 11 categories.
Admin panel at `/[lang]/admin`. Stack: Next.js 16 App Router (Turbopack), React 19, Tailwind 4,
Drizzle + PostgreSQL 17 (Docker `serfeli-db`, port 5433, user/db `serfeli`), vitest, zod 4.

Don't read whole docs up front. This file is the map; open `docs/ARCHITECTURE.md` only for the
recipe you need (search its "How to add things" headings). `docs/SUPPLIERS.md` = store research.
`docs/DEPLOY.md` = production: Vercel (site, region fra1) + Neon (DB) + GitHub Actions (daily 07:00 / follows 10:00 Baku).

## Where things are

| Need | File |
|---|---|
| Categories + keyword hints | `src/config/categories.ts` (`CATEGORY_HINTS`, `detectCategory`) |
| Subcategory rules (≤10/category) | `src/config/subcategories.ts` (`classifyProduct`) |
| Audience (women/men/kids/unisex) | `src/config/audience.ts` |
| Market (FX, customs, forwarders, `staleAfterHours: 48`) | `src/config/markets/az.ts`; items below `deals.minItemPrice` (300 TL / 10 AZN / 10 USD / 10 EUR) are never collected (`pricing/min-price.ts`, applied in `pipeline.ts` before ingest) |
| DB schema / migrations | `src/db/schema/index.ts`, `src/db/migrations/` (0000–0027) |
| Store adapters | `src/modules/suppliers/adapters/{shopify,structured-data,akinon,admitad}/{adapter,stores}.ts` (akinon = category pages, cart prices, discounted-only + `RawOffer.updateOnly`; admitad = affiliate product feeds streamed and filtered to a few thousand offers, `select.ts`, env `ADMITAD_*`, docs/DEPLOY.md §8) |
| Code store list → daily job | `suppliers/registry.ts` (`getAdapters`, `getAllAdapters` = code + admin stores) |
| Stores added in the panel | `suppliers/custom-config.ts` (zod, client-safe), `suppliers/custom.ts` (adapters, preview) |
| HTTP (polite client, robots, gzip) | `suppliers/http.ts`, `suppliers/robots.ts` |
| Matching listings → products | `catalog/matching.ts` (GTIN → brand+mpn → brand+model), `catalog/ingest.ts` |
| Sizes (clothes, shoes) | `suppliers/sizes.ts` (Shopify options, schema.org variants, Akinon embedded data; sorting) → `offers.sizes` → `deals.sizes` (in-stock `sizeKey`s); filter `?sizes=` only in `SIZED_CATEGORIES` (`config/categories.ts`), off by default; UI `components/product/size-finder.tsx`, `size-list.tsx`, `deals/size-filter.tsx` |
| Brand / article numbers | `catalog/normalizers/fashion.ts` (`KNOWN_BRANDS`, `ARTICLE_FORMATS`) |
| Locks / placement rules (pure) | `catalog/locks.ts`, `catalog/placement.ts` (`reclassify`, `resolvePlacement`) |
| Manual offers, merges | `catalog/manual-offers.ts`, `catalog/merge.ts` |
| Freshness (live = seen < 48 h and not removed) | `catalog/offer-view.ts` (`freshSince`, `offerIsLive`, `hasFreshOffer`); a successful read of a store's *whole* listing (adapter calls `ctx.listedEverything()`; Shopify under 1,000 products — never sitemap samples) marks offers it no longer lists (`offers.removed_at`, `ingest.ts` `markUnlistedOffers`). A sold-out listing only updates an offer we already track (`withoutUntracked`); crawler stores remember untracked sold-out pages (`sold_out_pages`) and sitemap stores read sold-out pages last (`ctx.soldOutPages`, `pickProductUrls`). robots.txt `Crawl-delay` is obeyed (`RobotsPolicy.fetch` → `client.slowTo`) |
| Is it a deal? | `catalog/summary.ts` (`discountBasis`: history after 14 days; store discounts our history does not confirm stay listed, ranked lower, while `market.deals.keepStoreClaims` — admin Settings → Deal rules, `settings/deal-rules.ts`, applied in `pricing/fx.ts` `loadMarket`); cards always show the store's own discount (`storeDiscount`); deals table built by `deals/build.ts` |
| Store health (auto-pause) | `suppliers/health.ts` (`STORE_HEALTH`: paused after 3 failed calendar days in a row, retried every 7 days, a success resumes; logged as `stores/store.paused` / `store.resumed`); columns `suppliers.failing_days`, `last_failed_on`, `paused_at`; status "paused" + "Resume now" in Admin → Stores |
| Daily pipeline | `deals/pipeline.ts` (stores collected in lanes, `planLanes`: Shopify shares one queue, 4 at a time; all other stores start at once, biggest first); publish/patch deals `deals/publish.ts` |
| Verified discounts (`/fresh`, home section, header; code calls them "fresh") | rule `deals/fresh-drop.ts` (pure: store-discounted items ≥5% below the highest price we recorded in the 7 days before, or the last check within 14; raise-then-cut counts; `market.deals.freshDrop`), saved to `fresh_deals` by `deals/build.ts`, read by `deals/fresh.ts` (paged, no cap); deal-list switch `?verified=1` (`DealFilters.freshOnly`); card line via `freshDropsOf` in `listDeals`, `ProductCard freshFocus` |
| Deal list queries + filters | `deals/queries.ts` ("Best deals" mixes stores: `bestOrder`, `market.deals.storeRepeatFactor`), `deals/filters.ts` |
| Search (+ az/ru/en synonyms) | `search/catalog-search.ts`, `search/synonyms.ts`; suggestions while typing and spelling fixes read only `search_terms` (brands, title words, repeated searches; rebuilt by the daily job, `search/terms.ts`, pure rules `search/spelling.ts`), API `api/search/suggest`, box `components/search/search-input.tsx`; a search that finds nothing runs the corrected words (`?exact=1` = as typed); default order `search/relevance.ts` (query read by the subcategory rules: "iphone 16" = phone before its cases; then words in the title) |
| Product photos, gallery (≤4, hover zoom) | `config/images.ts` (`usableImage`, `GALLERY_MAX`, `galleryImages`); adapters fill `RawOffer.images` → `offers.images` (read only by `catalog/gallery.ts` `productGallery`); UI `components/product/product-gallery.tsx`, `zoom-image.tsx` |
| Cart / parcel planner | `modules/cart/plan.ts` (pure: parcels per store), `cart/service.ts`; cost `pricing/landed-cost.ts` `computeParcelCost`; browser cart `components/cart/cart-store.ts` (localStorage); page `(site)/cart` |
| Follow brand/store/category → new deals | `modules/follows/*` (`match.ts` pure, `notify.ts` = daily 10:00 job); `deals.deal_since` kept across rebuilds in `deals/build.ts` |
| Email (Resend), confirm address, reset password | `modules/email/send.ts` (Resend HTTP API; off without `RESEND_API_KEY` + `EMAIL_FROM`, docs/DEPLOY.md §7), `email/layout.ts` (one design, pure); `auth/email-links.ts` (single-use hashed links in `auth_tokens`: verify 24 h, reset 1 h, ≤3/hour; reset signs out everywhere); pages `(site)/forgot-password`, `reset-password`, `verify-email`; texts `t.email` |
| Messages = requests (customer ↔ team, "buy this for me") | `modules/messages/*` (`rules.ts` pure: waiting → open on the team's first reply → closed by an admin, one waiting request per person; `details.ts` items snapshot; `service.ts`, `actions.ts`, `notify.ts` Telegram heads-ups); Write to us `(site)/messages/new` (`?offer=` attaches an item = "Order with our help", `?cart=1` opens the cart's parcels); `admin/messages`; UI `components/messages/*`; replies show as "Admin". Old `order_requests` are a read-only archive (`modules/orders/service.ts`) |
| Logging (Admin → Logs) | `modules/logs/logger.ts` — `log.info/warn/error(area, event, message, { userId, error, …})`: console + `app_logs` table, secrets stripped (`sanitize.ts`), ≤30/min per event; server crashes via `src/instrumentation.ts` `onRequestError`; pruned by the daily job (`service.ts` `pruneLogs`: info 14 d, warn/error 30 d). Use it instead of `console.error` |
| Analytics (Admin → Analytics) | `modules/analytics/*`: `visitor.ts` (cookieless daily visitor id, bots, device, source), `record.ts` (views via `POST /api/track` from `components/analytics/page-tracker.tsx`, searches from the search page, clicks in `app/go/[offerId]`), `report.ts` (queries; `saveDailyStatsAndPrune` in the daily job: `daily_stats` forever, `site_events` 90 days). Admins and bots are not counted |
| Recommended for you (switch: Admin → Settings → Features, `settings/features.ts`) | `modules/recommendations/*`: `profile.ts` (pure, client-safe: the interest profile kept in the visitor's browser — the only contract), `rank.ts` (pure), `service.ts` `recommendDeals` (the one server entry; reuses `listDeals`); API `POST /api/recommendations`; browser side `components/recommendations/*` (`interest-store.ts` localStorage, `InterestTracker` on product + search pages, `RecommendedRow` on home + deal lists, fetched after the page shows). Nothing about interests is stored on our side |
| Price alerts, notifications, push | `modules/alerts/*` (`check.ts` runs after each daily run); header bell `components/notifications/notification-bell.tsx` |
| Day's top deals (digest) | `modules/digest/pick.ts` (pure), `digest/service.ts`; page `(site)/top` |
| Telegram (channel post, bot, account link) | `modules/telegram/*` (`format.ts` = all message text, pure); webhook `app/api/telegram/webhook` |
| Site settings (admin → Settings) | `modules/settings/*` (`site_settings` table); deal-filter switches `filter-switches.ts` (client-safe defaults), applied in `parseDealFilters` + `FilterSidebar` |
| Display order (admin → Order) | `modules/settings/display-order.ts` (client-safe: `orderedCategories`, `orderedSubcategories`, `orderedBrands`); used by header, footer, home, `FilterSidebar`; editor `components/admin/display-order-form.tsx`, counts `modules/admin/ordering.ts`. List categories via `orderedCategories(await getDisplayOrder())`, not `CATEGORIES` |
| "Run now" (Admin → Daily runs) | `modules/admin/jobs.ts` starts the GitHub Actions workflows (`daily-deals.yml` with `only`, `follows.yml`) and lists their runs; env `GITHUB_REPO` + `GITHUB_ACTIONS_TOKEN` (docs/DEPLOY.md §6); action `admin/actions/jobs.ts`, form `components/admin/job-runner.tsx` |
| Admin services / actions / text | `src/modules/admin/*`, `modules/admin/actions/*`, `src/i18n/dictionaries/admin/{en,az,ru}.ts` |
| Admin UI | `src/components/admin/*` (ui.tsx primitives, fields.tsx `useAdminForm`), pages `src/app/[lang]/admin/` |
| Public pages | `src/app/[lang]/(site)/…` (route group; URLs have no "(site)") |
| Site text | `src/i18n/dictionaries/{en,az,ru}.ts` (`Dictionary = typeof en`) |
| Terms / privacy, error pages, SEO | texts `i18n/dictionaries/legal/*` (update `LEGAL_UPDATED` with any change; keep them true to what the code stores), pages `(site)/terms`, `(site)/privacy`; `error.tsx` per segment + `app/global-error.tsx`; `app/robots.ts`, `app/sitemap.ts`, `[lang]/opengraph-image.tsx`, `metadataBase` in `[lang]/layout.tsx` |

## Commands

```
npm run dev                         # usually already running in the user's terminal tab 0 (port 3000)
npm run deals:run [-- --only a,b]   # full run ~35 min; run it in the user's terminal, not in background
npm run deals:rebuild               # re-sort + rebuild deals from saved offers (~3 s)
npm run status -- store <id> off    # or the admin panel
npm run admin -- grant <email>      # admin access
npm run store:probe -- <host>       # check a sitemap/schema.org store before adding it
npm run follows:notify              # new deals → followers (bell + Telegram); meant for 10:00 daily, safe to rerun
npm run telegram -- status          # bot/channel check; also: digest [--again], listen, webhook <url>|off
npm run typecheck && npm run lint && npm test   # before finishing (all must pass)
npm run db:generate && npm run db:migrate       # after editing the schema; then rename the file to a readable tag (+ meta/_journal.json)
npx next typegen                    # after moving routes, if typecheck complains about .next/types
docker exec -i serfeli-db psql -U serfeli -d serfeli   # SQL (note -i for heredocs)
```

## Rules

- Pages are thin; logic lives in `src/modules`. `modules/` never imports from `components/` or `app/`.
- Money is integer minor units. Nothing hard-codes a country (except existing `Asia/Baku` date formatting).
- Never Tailwind `dark:`; use CSS tokens in `globals.css`. Layouts must work at 375 px.
- User-facing text in all three dictionaries; admin text in the admin dictionaries.
- Only reliable stores (official brand stores / established retailers). Respect robots.txt; never
  evade rate limits or bot protection (Shopify 429 → stop and wait).
- Every Server Action calls `requireAdmin()` (admin) itself; admin changes are logged with `recordAdminEvent`.
- Hand-set product fields are locked; automatic rules must go through `reclassify` / respect `lockedFields`.

## Gotchas (learned the hard way)

- Drizzle: inside raw `sql\`…\`` in a **select list**, `${table.col}` renders unqualified
  (`"id"`), so subqueries compare the wrong columns. Use `${eq(a.col, b.col)}` / `${gte(...)}`.
  A raw `${date}` param is not serialized; pass `date.toISOString()` + `::timestamptz`.
- Client components must not import modules that pull in `@/db/client` or `suppliers/http.ts`
  (value imports). Keep shared lists in client-safe files (`custom-config.ts`, `list-price.ts`).
- React resets a form after its action and `<select>` falls back to its first default: use
  `useAdminForm` and put its `key` on the `<form>`.
- Browsers lack full Azerbaijani locale data: in client components format with `formatNumber` / `formatDay` / `formatWeekday` (`i18n/format.ts`, money via `formatMoney`), never `Intl` / `toLocaleString`, or server and browser disagree (hydration errors, "M10 15").
- Text matching uses `foldForMatching` (Turkish/Azerbaijani letters → ASCII); write rules in ASCII.
- Shopify serves prices in the visitor's currency: read `cart_currency` (`servedCurrency`).
- Background shell commands get killed on long runs; long jobs go to the user's terminal.
- Scripts load `.env` with `--env-file-if-exists` (production has no `.env`; GitHub Actions passes secrets as env).
- A `position: fixed` element inside the header is pinned to the header (its `backdrop-blur`
  makes a containing block): portal toasts/menus to `document.body`.
- Telegram is optional (env `TELEGRAM_*`); every path must work without it. Without a webhook,
  messages to the bot are fetched only while someone connects, or by `npm run telegram -- listen`.
- macOS blocks launchd from ~/Desktop, so the daily schedule can't be installed until the project moves.
- A running `deals:run` keeps its old code in memory; changes apply from the next run.
- Neon free plan caps **network transfer at 5 GB/month** (hit on 2026-10-20). Every full rebuild reads the whole catalog: select only the columns you need (never a store's full row per offer), send history grouped per offer, keep per-page-view reads small (home tiles are a daily snapshot, `catalog/popular.ts`), and avoid extra full runs.
- Testing admin pages: create a throwaway admin + session row in the local DB, set the `session`
  cookie in the browser pane, and delete the user, its `admin_events` and any test data afterwards.

## Working with the user

- Reply in Azerbaijani when they write in Azerbaijani.
- Give runnable commands as separate ```bash blocks.
- Don't add stores or run long collections without saying so; confirm before data-changing actions
  on real records.
