# JDM Vehicle Finder

Automated Japanese auction vehicle finder and client notifier for JDM Connect.

It runs on a schedule, searches the live AVTONET auction feed against each client's
wishlist, sends you a digest of new matches to approve, and on approval emails the car
to the client (WhatsApp is wired in and ready for a provider in Phase 2).

## How it works

```
Cron (every 6h)  ->  matcher  ->  AVTONET SQL API (live `main` feed)
                                      |
                                      v
                         new matches -> D1 queue -> digest email to you
                                                         |
                                       you click "Approve & send"
                                                         v
                                            client gets the car by email
```

- Searching uses the provider's SQL API with filtered queries per wishlist (compliant
  with their rule: never mirror the whole feed locally).
- Every match needs your approval before any client is contacted.
- Each lot is only ever surfaced once per wishlist (deduped via the `seen_lots` table).

## Dealer portal integration

The [`jdm-dealer-portal`](https://github.com/jatecurtis95/jdm-dealer-portal)
writes vehicle requests straight into this database (it binds this D1 as
`FINDER_DB`), so dealers self-serve from the portal and the matcher picks their
requests up automatically. Two columns support this:

- `clients.dealer_username` — which portal dealer created a request (`NULL` for
  staff-entered clients). Scopes a dealer's view to their own requests.
- `wishlists.auto_notify` — `1` makes the matcher deliver matches immediately and
  skip the approval digest; `0` (default) keeps the manual review flow.

Apply both to the live DB once with:

```bash
npx wrangler d1 execute jdm-vehicle-finder --remote --file migrate-portal.sql
```

then `npx wrangler deploy` so the matcher honours `auto_notify`.

## Working from another computer (e.g. your Windows PC)

This project lives on GitHub (private repo `jatecurtis95/jdm-vehicle-finder`). GitHub is
the bridge between machines — you don't copy files manually.

On a new computer:

1. Install **GitHub Desktop** and sign in with the same GitHub account.
2. **Clone** `jatecurtis95/jdm-vehicle-finder`. This downloads every project file.
3. Install **Node.js** (https://nodejs.org).
4. In the project folder, run `npm install` (rebuilds `node_modules`, which isn't in Git).
5. Run `npx wrangler login` once, to connect this computer to your Cloudflare account.

After that you can edit, then `npx wrangler deploy` to publish — exactly like on the Mac.

Day to day: edit on one machine, then in GitHub Desktop **Commit to main** and **Push**.
Before editing on the other machine, **Pull** first so both stay in sync.

You do **not** need to re-enter any secrets — the API code, Resend key and admin token
live on Cloudflare, not in the files, and deploys use them automatically. The relay file
is on your website and the database is on Cloudflare; both are shared by every machine.

## Security (where the keys are)

- Cloudflare secrets (`AVTONET_CODE`, `RESEND_API_KEY`, `ADMIN_TOKEN`) are stored encrypted
  on Cloudflare, never in these files.
- `relay/jdm-relay.php` contains the auction API code and relay token in plaintext. PHP runs
  server-side, so website visitors can never see them — but anyone with your web hosting login
  or access to this (private) repo can. Keep the repo private.
- Optional good practice: ask the auction provider to rotate the API code, then update the
  relay file and the `AVTONET_CODE` Worker secret.

## One-time setup

You'll do this from Terminal on your Mac, in this project folder.

### 1. Install dependencies

```
npm install
```

### 2. Create the D1 database

```
npx wrangler d1 create jdm-vehicle-finder
```

Copy the `database_id` it prints into `wrangler.toml` (replace
`REPLACE_WITH_YOUR_D1_DATABASE_ID`).

### 3. Load the schema

```
npx wrangler d1 execute jdm-vehicle-finder --remote --file schema.sql
```

### 4. Set secrets

```
npx wrangler secret put AVTONET_CODE      # your API password (e.g. JCNnBvGfF54k)
npx wrangler secret put RESEND_API_KEY     # from resend.com
npx wrangler secret put ADMIN_TOKEN        # any long random string you choose
```

For email you need a [Resend](https://resend.com) account and a verified sender
domain (so mail from `alerts@jdmconnect.com.au` is trusted). Resend's free tier is
plenty to start. Update `MAIL_FROM` and `DIGEST_EMAIL` in `wrangler.toml` if needed.

### 5. Deploy

```
npx wrangler deploy
```

Wrangler prints your Worker URL (e.g. `https://jdm-vehicle-finder.<you>.workers.dev`).
Put that into `PUBLIC_URL` in `wrangler.toml`, then deploy once more so the
approve/skip links point to the right place:

```
npx wrangler deploy
```

## Using it

- **Admin page:** `https://<your-worker-url>/admin?key=YOUR_ADMIN_TOKEN`
  Add clients, add wishlists, see what's queued.
- **Run now (test):** click "Run matcher now" on the admin page, or visit
  `/run?key=YOUR_ADMIN_TOKEN`.
- **Approve matches:** they arrive in your inbox (the `DIGEST_EMAIL` address). Click
  "Approve & send" to email the car to the client, or "Skip" to discard.
- **Automatic schedule:** the cron in `wrangler.toml` runs it every 6 hours. Change
  `crons` to adjust (e.g. `"0 22 * * *"` for once daily at 22:00 UTC).

## Wishlist fields

| Field | Meaning |
|-------|---------|
| Maker | Exact maker, e.g. `TOYOTA` |
| Model | Substring match, e.g. `COROLLA` |
| Year min / max | Model year range |
| Max price (JPY) | Matched against the lot's market estimate (`avg_price`) |
| Max mileage (km) | Upper mileage limit |
| Min grade | Minimum auction condition grade, e.g. `4`, `4.5` |
| Chassis code | Substring match, e.g. `ZRE212` |
| Grade keyword | Substring of the grade/trim text, e.g. `RS` |

## Data source notes

The AVTONET API exposes two tables:
- `main` — live/upcoming lots (~90k at any time). This is what we search.
- `stats` — ~2.3M historical sold results. Reserved for Phase 2 valuation.

Field names confirmed live: `id, lot, auction_type, auction_date, auction, marka_id,
model_id, marka_name, model_name, year, town, eng_v, pw, kuzov, grade, color, kpp,
kpp_type, priv, mileage, equip, rate, start, finish, status, time, avg_price,
avg_string, lhdrive, images, serial, info`.

## Roadmap

- **Phase 1 (this build):** scheduled matching, approval digest, email delivery, admin UI.
- **Phase 2:** WhatsApp delivery (Twilio — see `src/notify.js`), market valuation and
  AU landed-cost per car using the `stats` table and the calculator API.
- **Phase 3:** client-facing wishlist requests inside the dealer portal; auto-provision
  client accounts via the platform's user API.

## Security

- The API code and all keys are stored as Wrangler secrets, never in the repo.
- The admin page is gated by `ADMIN_TOKEN`. Keep that URL private; rotate the token if
  it leaks.
- If the API code (`JCNnBvGfF54k`) has been shared anywhere public, ask the provider to
  rotate it and update the `AVTONET_CODE` secret.
