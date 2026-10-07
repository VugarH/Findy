# Sərfəli

Verified discounts and the true landed price (item + delivery + customs + fees) from local and
global stores. First market: Azerbaijan. "Sərfəli" is a working name — change it in
`src/config/site.ts`.

> Real prices come from the stores listed in `docs/SUPPLIERS.md`: two Azerbaijani stores
> (smartphones) and about 90 official brand stores and retailers abroad. Set `NEXT_PUBLIC_DEMO_DATA=true` to run on fictional stores instead.

## Run it

Requires Node 20+ and Docker.

```bash
cp .env.example .env
npm install
npm run db:up && npm run db:migrate
npm run deals:run   # collects today's prices from every store (about 20 minutes)
npm run dev         # http://localhost:3000
```

## Admin panel

`/az/admin` (or `/en/admin`, `/ru/admin`): stores, products, categories, order requests, daily
runs, an activity log and users. Sign up on the site, then give your account access once:

```bash
npm run admin -- grant you@example.com
```

After that, admins can give access to others on the panel's Users page. To everyone else the panel
does not exist (404).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run deals:run` | Run the daily deals pipeline once |
| `npm run deals:rebuild` | Rebuild the deal list from stored offers, without contacting stores |
| `npm run store:probe -- <host>` | Check whether a store can be connected through its sitemap and product data |
| `npm run status -- store <id> off` | Switch a store off: the daily job skips it and its products disappear (`on` to undo) |
| `npm run status -- product <slug> off` | Switch a product off: it disappears and its prices stop being recorded (`on` to undo) |
| `npm run status -- list` | Show what is switched off |
| `npm run admin -- grant <email>` | Let an account open the admin panel (`revoke <email>`, `list`) |
| `npm run follows:notify` | Tell followers about new deals from brands, stores and categories they follow (run daily at 10:00) |
| `npm run telegram -- status` | Check the Telegram bot and channel (`digest [--again]`, `listen`, `webhook <url>` / `off`) |
| `npm run suppliers:list` | Stores in use, with the exact method used to read each one |
| `npm run db:seed` | Demo mode only: back-fill 90 days of generated prices |
| `npm run db:generate` / `db:migrate` | Create / apply a migration after editing `src/db/schema` |
| `npm run db:studio` | Browse the database |
| `npm test` | Unit tests (pricing, discount verification, scoring) |
| `npm run typecheck` / `npm run lint` | Static checks |

## Cart

Visitors add products with the bag button on any deal or product page. The cart page groups them
into parcels, one per store, and shows each parcel's total with one delivery charge and customs
on the parcel's value, a warning when it passes the duty-free limit, delivery days, and links to
the store and each listing. The cart is kept in the browser; no account is needed.

## Telegram

Every full daily run picks the day's top 10 deals (shown at `/top` and under the bell in the
header) and posts them to a Telegram channel. People who connect our bot on the Price alerts page
also get their price drops in Telegram. All of it is optional; without the settings the site works
as before.

1. In Telegram, open @BotFather, send `/newbot`, and put the token into `TELEGRAM_BOT_TOKEN` in `.env`.
2. Create a public channel, add the bot as an admin that may post messages, and put `@channel_name`
   into `TELEGRAM_CHANNEL_ID`.
3. Set `SITE_URL` to the site's public address (links in the messages point there).
4. Restart `npm run dev`, then check: `npm run telegram -- status`.

`npm run telegram -- digest` posts today's list now. Messages to the bot (the "Start" that
connects an account) are fetched by the site while someone is connecting; once the site is public,
set `TELEGRAM_WEBHOOK_SECRET` and run `npm run telegram -- webhook https://your-site` so Telegram
delivers them. The admin panel's Telegram page shows the setup, today's list with a preview of
the post, and buttons to pick again or post.

## Adding a store

In the admin panel (Stores → Add a store) for a Shopify store, a store with a product sitemap and
schema.org product data, or a shop whose prices you enter by hand; "Test connection" shows what a
run would save before you add it. `npm run store:probe -- www.example.com.tr` suggests the sitemap
settings. Stores can also be added in code — see `docs/ARCHITECTURE.md`.

## Scheduling the daily job

On a Mac without a server: `./scripts/schedule-daily.sh install` runs `scripts/daily.sh` every day
at 06:00 (or when the Mac wakes, if it was asleep), starting Docker and the database when needed.
Logs go to `logs/daily-<date>.log`. macOS keeps background jobs out of Desktop, Documents and
Downloads, so the project must live elsewhere (e.g. `~/Projects/discountFinder`).

On a server, run `npm run deals:run` from any scheduler, or call the endpoint:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-host/api/cron/daily-deals
```

More: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
