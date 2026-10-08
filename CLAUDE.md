@AGENTS.md

# Sərfəli — project guide

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
| Market (FX, customs, forwarders, `staleAfterHours: 48`) | `src/config/markets/az.ts` |
| DB schema / migrations | `src/db/schema/index.ts`, `src/db/migrations/` (0000–0015) |
| Store adapters | `src/modules/suppliers/adapters/{shopify,structured-data}/{adapter,stores}.ts` |
| Code store list → daily job | `suppliers/registry.ts` (`getAdapters`, `getAllAdapters` = code + admin stores) |
| Stores added in the panel | `suppliers/custom-config.ts` (zod, client-safe), `suppliers/custom.ts` (adapters, preview) |
| HTTP (polite client, robots, gzip) | `suppliers/http.ts`, `suppliers/robots.ts` |
| Matching listings → products | `catalog/matching.ts` (GTIN → brand+mpn → brand+model), `catalog/ingest.ts` |
| Sizes (clothes, shoes) | `suppliers/sizes.ts` (Shopify options, schema.org variants, Akinon embedded data; sorting) → `offers.sizes` → `deals.sizes` (in-stock `sizeKey`s); filter `?sizes=` only in `SIZED_CATEGORIES` (`config/categories.ts`), off by default; UI `components/product/size-finder.tsx`, `size-list.tsx`, `deals/size-filter.tsx` |
| Brand / article numbers | `catalog/normalizers/fashion.ts` (`KNOWN_BRANDS`, `ARTICLE_FORMATS`) |
| Locks / placement rules (pure) | `catalog/locks.ts`, `catalog/placement.ts` (`reclassify`, `resolvePlacement`) |
| Manual offers, merges | `catalog/manual-offers.ts`, `catalog/merge.ts` |
| Freshness (live = seen < 48 h and not removed) | `catalog/offer-view.ts` (`freshSince`, `offerIsLive`, `hasFreshOffer`); a successful read of a store's *whole* listing (adapter calls `ctx.listedEverything()`; Shopify under 500 products — never sitemap samples) marks offers it no longer lists (`offers.removed_at`, `ingest.ts` `markUnlistedOffers`) |
| Is it a deal? | `catalog/summary.ts`; deals table built by `deals/build.ts` |
| Daily pipeline | `deals/pipeline.ts` (stores collected in lanes, `planLanes`: Shopify shares one queue, 4 at a time; all other stores start at once, biggest first); publish/patch deals `deals/publish.ts` |
| Deal list queries + filters | `deals/queries.ts`, `deals/filters.ts` |
| Search (+ az/ru/en synonyms) | `search/catalog-search.ts`, `search/synonyms.ts` |
| Cart / parcel planner | `modules/cart/plan.ts` (pure: parcels per store), `cart/service.ts`; cost `pricing/landed-cost.ts` `computeParcelCost`; browser cart `components/cart/cart-store.ts` (localStorage); page `(site)/cart` |
| Follow brand/store/category → new deals | `modules/follows/*` (`match.ts` pure, `notify.ts` = daily 10:00 job); `deals.deal_since` kept across rebuilds in `deals/build.ts` |
| Price alerts, notifications, push | `modules/alerts/*` (`check.ts` runs after each daily run); header bell `components/notifications/notification-bell.tsx` |
| Day's top deals (digest) | `modules/digest/pick.ts` (pure), `digest/service.ts`; page `(site)/top` |
| Telegram (channel post, bot, account link) | `modules/telegram/*` (`format.ts` = all message text, pure); webhook `app/api/telegram/webhook` |
| Site settings (admin → Settings) | `modules/settings/*` (`site_settings` table); deal-filter switches `filter-switches.ts` (client-safe defaults), applied in `parseDealFilters` + `FilterSidebar` |
| Display order (admin → Order) | `modules/settings/display-order.ts` (client-safe: `orderedCategories`, `orderedSubcategories`, `orderedBrands`); used by header, footer, home, `FilterSidebar`; editor `components/admin/display-order-form.tsx`, counts `modules/admin/ordering.ts`. List categories via `orderedCategories(await getDisplayOrder())`, not `CATEGORIES` |
| Admin services / actions / text | `src/modules/admin/*`, `modules/admin/actions/*`, `src/i18n/dictionaries/admin/{en,az,ru}.ts` |
| Admin UI | `src/components/admin/*` (ui.tsx primitives, fields.tsx `useAdminForm`), pages `src/app/[lang]/admin/` |
| Public pages | `src/app/[lang]/(site)/…` (route group; URLs have no "(site)") |
| Site text | `src/i18n/dictionaries/{en,az,ru}.ts` (`Dictionary = typeof en`) |

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
- Testing admin pages: create a throwaway admin + session row in the local DB, set the `session`
  cookie in the browser pane, and delete the user, its `admin_events` and any test data afterwards.

## Working with the user

- Reply in Azerbaijani when they write in Azerbaijani.
- Give runnable commands as separate ```bash blocks.
- Don't add stores or run long collections without saying so; confirm before data-changing actions
  on real records.
