# Deploying for free: Vercel + Neon + GitHub Actions

| Part | Where | Notes |
|---|---|---|
| Website | Vercel (Hobby) | deploys itself on every `git push` to `main`; region `fra1` (vercel.json) |
| Database | Neon, created from Vercel → Storage (Free: 0.5 GB) | Postgres, region Frankfurt |
| Daily job, 10:00 job | GitHub Actions | `.github/workflows/daily-deals.yml` (07:00 Baku), `follows.yml` (10:00 Baku) |

Limits to keep in mind: Vercel Hobby is for non-commercial projects; Neon Free holds 0.5 GB
(116 MB on 2026-10-08, growing a few MB a day); "Collect now" in the admin panel stops after
5 minutes on Vercel, so collect big stores through Actions → Daily deals → Run workflow.

## 1. Website and database (Vercel, with Neon inside it)

1. Sign up at https://vercel.com with your GitHub account (Hobby plan).
2. **Add New → Project → Import** `VugarH/Findy`. Framework: Next.js (detected); don't change the
   build settings. Press **Deploy** — the first deploy builds but pages fail until the database is
   connected; that is expected.
3. In the project: **Storage → Create Database → Neon** (Serverless Postgres), Free plan,
   region **Frankfurt (eu-central-1)**. Connect it to the project for **Production** and
   **Development**; switch **Preview branching off** (each preview would copy the database, and
   the free plan allows 10).
4. Vercel adds the database addresses to the project's environment variables by itself:
   `DATABASE_URL` (pooled — the site uses this) and `DATABASE_URL_UNPOOLED` (direct). Open
   **Settings → Environment Variables**, reveal `DATABASE_URL_UNPOOLED` and copy it: that is
   `<NEON_DIRECT_URL>` below.

### Copy your local data into Neon

Keeps every product, price history, your account and admin rights. Run with your **direct**
string in place of `<NEON_DIRECT_URL>` (keep the quotes):

```bash
docker exec -e TARGET="<NEON_DIRECT_URL>" serfeli-db sh -c 'pg_dump -U serfeli -d serfeli --no-owner --no-privileges --no-comments | psql "$TARGET" -q'
```

Check it arrived (should print about 7,600):

```bash
docker exec -e TARGET="<NEON_DIRECT_URL>" serfeli-db sh -c 'psql "$TARGET" -At -c "select count(*) from deals"'
```

## 2. Secrets for the jobs (GitHub)

Repository **Findy → Settings → Secrets and variables → Actions**.

**Secrets** tab (hidden values):

| Name | Value |
|---|---|
| `DATABASE_URL` | the **direct** address (`DATABASE_URL_UNPOOLED` in Vercel) |
| `TELEGRAM_BOT_TOKEN` | your bot token |
| `TELEGRAM_WEBHOOK_SECRET` | a random string (see "Random values" below) — same in Vercel and your `.env` |
| `VAPID_PRIVATE_KEY` | from your `.env` |

**Variables** tab (visible values):

| Name | Value |
|---|---|
| `SITE_URL` | your Vercel address, e.g. `https://findy-xyz.vercel.app` |
| `TELEGRAM_CHANNEL_ID` | `@findy_az` |
| `TELEGRAM_CHANNEL_LOCALE` | `az` |
| `BOT_CONTACT` | from your `.env` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | from your `.env` |
| `VAPID_SUBJECT` | from your `.env` |

## 3. The site's other settings (Vercel)

**Settings → Environment Variables** (Production), next to the database ones Vercel added:

| Name | Value |
|---|---|
| `MARKET` | `az` |
| `CRON_SECRET` | a random string |
| `NEXT_PUBLIC_DEMO_DATA` | `false` |
| `BOT_CONTACT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | from your `.env` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`, `TELEGRAM_CHANNEL_LOCALE` | as in your `.env` |
| `TELEGRAM_WEBHOOK_SECRET` | the same random string as in GitHub |
| `SITE_URL` | the project's address, e.g. `https://findy-xyz.vercel.app` (Settings → Domains) |

Then **Deployments → … (latest) → Redeploy** so the site picks everything up. Set the same
`SITE_URL` as a GitHub variable too.

## 4. Telegram webhook

So the bot answers "Start" from the live site. On your laptop, put the same
`TELEGRAM_WEBHOOK_SECRET` in `.env`, then (on a network where Telegram is reachable):

```bash
npm run telegram -- webhook https://findy-xyz.vercel.app
```

`npm run telegram -- status` should then say messages arrive by webhook.

## 5. First run

GitHub → **Actions → Daily deals → Run workflow** (leave the store list empty). It takes about
25 minutes; the log shows the same table as in your terminal. After that it runs every day at
07:00 Baku time, and "Follow notifications" at 10:00. GitHub e-mails you when a run fails.

## 6. "Run now" in the admin panel (optional)

Admin → Daily runs can start the daily job and the follow notifications. They still run on GitHub
Actions (a Vercel request can't run 35 minutes); the panel asks GitHub to start them and shows
their recent runs. It needs a token that may only start this repository's workflows:

1. GitHub → your picture → **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. Name `findy-admin-jobs`; expiration as you like (e.g. 1 year — note the date).
3. **Repository access → Only select repositories → Findy**.
4. **Permissions → Repository permissions → Actions: Read and write** (Metadata: read is added by itself).
5. Generate, copy the token (starts with `github_pat_`).
6. Vercel → Settings → Environment Variables (Production):
   - `GITHUB_REPO` = `VugarH/Findy`
   - `GITHUB_ACTIONS_TOKEN` = the token
   then **Redeploy**.

Every start is recorded under Admin → Activity; a refused start is in Admin → Logs.

## 7. Email (Resend): address confirmation and password reset (optional)

Without these settings the site works as before (no emails, "Forgot your password?" says email is
not available). Needs your own domain.

1. resend.com → **Domains → Add domain** (region Ireland) → add the DNS records it shows at your
   registrar → wait for **Verified**.
2. **API Keys → Create** — "Sending access", your domain. Copy it (starts with `re_`).
3. Vercel → Environment Variables (Production), then **Redeploy**:
   - `RESEND_API_KEY` = the key
   - `EMAIL_FROM` = `Findy <noreply@your-domain>`
   - optional `EMAIL_REPLY_TO` = an inbox that receives replies

Sent and failed emails appear in Admin → Logs (`auth/email.sent`, `auth/email.failed`).

## 8. Admitad affiliate stores (AliExpress, optional)

Stores joined through Admitad are read from the product feeds Admitad builds
(`src/modules/suppliers/adapters/admitad`). The daily job needs the account's feed
settings; without them those stores are skipped. In Admitad: Product Feeds →
pick the program and feed → Generate. The link looks like
`…/websites/3013554/products/export_adv_products/?user=PID…&code=…`.

GitHub → Settings → Secrets and variables → Actions:

| Kind | Name | Value |
|---|---|---|
| Variable | `ADMITAD_WEBSITE_ID` | the number after `/websites/` |
| Variable | `ADMITAD_FEED_USER` | the `user=` value |
| Secret | `ADMITAD_FEED_CODE` | the `code=` value (works like a password for your feeds) |

The AliExpress feed is ~850 MB: the job streams it and keeps 5,000 offers; it
adds a few minutes to the run, not to the database.

## Random values

```bash
openssl rand -hex 32
```

## After this

- Every `git push` to `main` updates the website. Database changes (new migrations) are applied
  by the next daily job, or right away with Actions → Daily deals → Run workflow
  (a store list like `sinoz` keeps it short).
- Your laptop keeps its own local database for development; the live site uses Neon.
