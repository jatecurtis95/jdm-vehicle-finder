# PHASE3_CHECKS.md - pre-decision checks for PHASE3_PLAN Section 8

Written 23 July 2026. Investigation only: no code changed, no migration
touched, `feat/phase1-filtering` untouched. Everything ran against LOCAL
D1 or generated test values; production was not queried from this session.
The one working file the tasks required (the throwaway hash-transform
script) was created, run, and deleted; its full source and output are
preserved in Task 2 below.

---

## TASK 1: Identity collisions across the four credential stores

### 1.1 Local D1 is not representative - stated plainly

The only local data available is `seed/seed-dev.sql`: 3 fabricated clients,
2 agents, 1 finder dealer, zero portal dealers (the portal repo ships no
dealer seed), zero `member`/`source`/`category` variety. I built the local
DB (`db:migrate:local` + `db:seed:local`, both explicitly permitted) and
ran every query below to prove the SQL executes; the results are
necessarily all zeroes and say nothing about production:

| Local check | Result |
|---|---|
| clients count / agents / finder dealers | 3 / 2 / 1 |
| clients~agents, clients~dealers, agents~dealers email overlaps | 0, 0, 0 |
| duplicate emails within clients | none |
| case-variant duplicates within agents | none |
| clients rows carrying dealer_username | 0 |

**You need to run the production queries yourself.** They are read-only
SELECTs. Exact commands follow; nothing here writes.

### 1.2 Production SQL to run yourself (read-only)

Finder database (clients, agents and the supplier dealers all live in the
one D1, so the cross-store overlaps are single queries):

```
npx wrangler d1 execute jdm-vehicle-finder --remote --json --command "
SELECT 'clients~agents' AS pair, COUNT(*) AS n
  FROM clients c JOIN agents a ON lower(c.email) = lower(a.email)
 WHERE c.email IS NOT NULL AND c.email <> ''
UNION ALL
SELECT 'clients~suppdealers', COUNT(*)
  FROM clients c JOIN dealers d ON lower(c.email) = lower(d.email)
 WHERE c.email IS NOT NULL AND c.email <> ''
UNION ALL
SELECT 'agents~suppdealers', COUNT(*)
  FROM agents a JOIN dealers d ON lower(a.email) = lower(d.email)"
```

Samples for whichever pair is non-zero (adjust the pair):

```
npx wrangler d1 execute jdm-vehicle-finder --remote --json --command "
SELECT c.id AS client_id, a.id AS agent_id, lower(c.email) AS email
  FROM clients c JOIN agents a ON lower(c.email) = lower(a.email)
 WHERE c.email <> '' LIMIT 10"
```

Duplicates WITHIN one store (agents and supplier dealers have UNIQUE email
indexes, but SQLite UNIQUE is case-sensitive, so check lower() anyway):

```
npx wrangler d1 execute jdm-vehicle-finder --remote --json --command "
SELECT lower(email) AS email, COUNT(*) AS n
  FROM clients WHERE email IS NOT NULL AND email <> ''
 GROUP BY lower(email) HAVING COUNT(*) > 1
 ORDER BY n DESC LIMIT 25"

npx wrangler d1 execute jdm-vehicle-finder --remote --json --command "
SELECT lower(email) AS email, COUNT(*) AS n FROM agents
 GROUP BY lower(email) HAVING COUNT(*) > 1"

npx wrangler d1 execute jdm-vehicle-finder --remote --json --command "
SELECT lower(email) AS email, COUNT(*) AS n FROM dealers
 GROUP BY lower(email) HAVING COUNT(*) > 1"
```

The portal-link population (how many container rows, how many distinct
portal dealers they claim):

```
npx wrangler d1 execute jdm-vehicle-finder --remote --json --command "
SELECT COUNT(*) AS container_rows,
       COUNT(DISTINCT dealer_username) AS distinct_dealer_usernames
  FROM clients WHERE dealer_username IS NOT NULL"
```

Portal database (separate D1, so cross-database overlap needs an offline
compare of two result sets):

```
npx wrangler d1 execute jdm-dealers --remote --json --command "
SELECT username, lower(COALESCE(email, '')) AS email, active FROM dealers ORDER BY username"

npx wrangler d1 execute jdm-vehicle-finder --remote --json --command "
SELECT DISTINCT lower(email) AS email, 'clients' AS store FROM clients WHERE email <> ''
UNION SELECT lower(email), 'agents' FROM agents
UNION SELECT lower(email), 'suppdealers' FROM dealers"
```

Save each output and compare offline (any spreadsheet, or
`node -e` over the two JSON files); the portal dealers table is small
enough to eyeball. Also compare the portal `username` list against the
finder's `DISTINCT dealer_username` values from the query above - a
username on either side without a partner is an orphaned link and worth a
sample before step 8 of the plan (the account import).

### 1.3 Uniqueness constraints today (file:line)

| Store | Email | Username / login key |
|---|---|---|
| agents | UNIQUE - `migrations/0001_baseline.sql:28` (`idx_agents_email`) | none (email is the login) |
| clients | NO uniqueness - `0001:34` plain `email TEXT`, only `idx_clients_agent` exists (`0001:47`); `authenticate()` explicitly tolerates up to 5 rows per email (`src/auth.js:420-427`) | none |
| finder supplier dealers | UNIQUE twice over - `migrations/0013_dealer_system.sql:9` (`email TEXT NOT NULL UNIQUE`) and `:22` (`idx_dealers_email`) | none (email is the login) |
| portal dealers (jdm-dealers DB) | NO uniqueness - portal `scripts/schema.sql:12` plain `email TEXT`, nullable | `username TEXT PRIMARY KEY` - portal `scripts/schema.sql:8` |

Note the SQLite caveat: those UNIQUE constraints are case-sensitive, so
`Ben@x.com` and `ben@x.com` can legally coexist even in agents/dealers.
The lower() queries above surface that.

### 1.4 The four questions, answered with reasoning

**If a person exists in two stores, do they become one user or two?**
TWO, at import time; ONE only later, through a deliberate, human-reviewed
merge tool. Reasons: (a) matching by email is guesswork - clients email is
non-unique by design and a shared business address ("sales@dealer.com")
can legitimately be an agent contact, a buyer account and a portal account
for different humans; (b) an automatic merge is destructive and this
migration's design rule is that every step is reversible; (c) the import
is keyed by portal username into a NEW column, so it cannot collide with
anything. The plan already imports portal rows with `type='dealer'`; this
check adds one refinement: import them with `portal_enabled = 0`, so the
finder's client login scan (`auth.js:420-427` filters on
`portal_enabled = 1`) never sees the imported rows and the two credential
paths cannot interfere even for identical emails.

**If one (when a merge does run), whose credential wins and what happens
to the other session?** The users table has ONE `pass_salt`/`pass_hash`
pair per row, so a merged row keeps one password. The surviving row must
be the CLIENT row (it owns the Stripe linkage, `google_sub`, and every
wishlists/queue/payments FK - `stripe.js:195-217`, `admin.js:7425-7438`);
the portal username moves onto it. Recommendation: keep whichever
credential was used most recently (`last_seen`, `0010:17`), and email the
person either way. Sessions: the finder cookie survives (same row id, same
`session_ver`) and the portal cookie survives (username preserved, portal
secret unchanged) - EXCEPT that whichever password lost the merge stops
working at next login, which is exactly why merges need comms and a human
in the loop, and why the import itself merges nothing.

**If two, what breaks, given email is used for notification delivery?**
Less than feared, because delivery is row-driven, not email-driven: match
notifications resolve the client row behind each queue row (per
`client_id`), so two rows sharing an email do not double-send one match.
What does need care: (a) the same human receives mail under two identities
(their dealer requests and their personal-buyer matches) - correct
behaviour for a trade buyer wearing two hats, but staff should see the
link, which the Users view can render once both rows exist; (b)
`createAdminRequest`'s match-or-create by contact (`admin.js:7595`) could
attach a staff-created request to the imported dealer row instead of the
person's buyer row - the build should exclude `type='dealer'` rows from
`findClientByContact`, or prefer `type='customer'` matches; (c) the
email-based password reset (`auth.js:568-587`) stays safe because the
imported rows are ineligible on the client path (`portal_enabled = 0`,
`portal_revoked` rule at `auth.js:572-574`) and the portal reset flow is
username-keyed.

**What uniqueness should the users table carry, and what happens to
violating rows at backfill?** Recommended: (1) partial unique index on
`username` (`WHERE username IS NOT NULL`) - cannot be violated at
backfill, because the column is new and its only writers are the import
(portal usernames are already a PRIMARY KEY among themselves); (2) NO
unique constraint on email - production clients data would likely violate
it on day one (the production dup query above sizes this), the login path
is built to tolerate duplicates, and forcing uniqueness now would demand
the dedup exercise before any Phase 3 value ships. So at backfill, by
construction, ZERO rows can violate the chosen constraints. If Ben later
wants email-unique (open question 5 in the plan), the dup counts from 1.2
size that clean-up, and it lands as its own later migration after merges.

---

## TASK 2: Password transform verification (empirical)

Method: a throwaway script imported the PORTAL's real hashing module
(`/workspace/jdm-dealer-portal/functions/lib/auth.js`, commit `10f3d2f`)
and the FINDER's real `verifyPassword` (`src/auth.js:145-159`), generated
fresh hashes for known passwords, applied the proposed transform, and
verified. No stored user hash was read. The script ran under Node 22
(same Web Crypto as the Workers runtime) and was deleted after the run.

The transform, exactly as the plan proposed:
base64url to base64 (`-` to `+`, `_` to `/`, restore `=` padding) on both
salt and hash, then prefix the hash with `100000.`.

Script source (preserved verbatim):

```js
import { hashPassword as portalHash, verifyPassword as portalVerify } from "/workspace/jdm-dealer-portal/functions/lib/auth.js";
import { verifyPassword as finderVerify } from "../src/auth.js";

const b64urlToB64 = (s) => {
  let t = String(s).replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  return t;
};
const transform = ({ salt, hash }) => ({
  salt: b64urlToB64(salt),
  hash: `100000.${b64urlToB64(hash)}`,
});

let allOk = true;
for (let trial = 1; trial <= 3; trial++) {
  const password = `correct horse battery staple ${trial}`;
  const wrong = `wrong password ${trial}`;
  const stored = await portalHash(password); // portal-format: base64url, no prefix
  const t = transform(stored);
  const selfOk = await portalVerify(password, stored.salt, stored.hash);
  const okRight = await finderVerify(password, t.salt, t.hash);
  const okWrong = await finderVerify(wrong, t.salt, t.hash);
  const okLegacy = await finderVerify(password, t.salt, b64urlToB64(stored.hash));
  const urlChars = /[-_]/.test(stored.salt + stored.hash);
  const rawUntransformed = await finderVerify(password, stored.salt, `100000.${stored.hash}`);
  // ... console reporting per trial ...
  if (!(selfOk && okRight && !okWrong && okLegacy)) allOk = false;
}
```

Actual output, verbatim:

```
trial 1:
  portal salt/hash (b64url):        8geAhXPZFyoDsr1Cbw2RuQ / JZp25KQAntRmWpqzbDUK8TO9_B4lAeEecLynRAGDkMs
  transformed salt/hash:            8geAhXPZFyoDsr1Cbw2RuQ== / 100000.JZp25KQAntRmWpqzbDUK8TO9/B4lAeEecLynRAGDkMs=
  portal self-verify:               true
  finder verify, correct password:  true
  finder verify, wrong password:    false
  finder verify, legacy bare hash:  true
  b64url-specific chars present:    true
  finder verify, UNtransformed:     false (expected false when url chars present)
trial 2:
  portal salt/hash (b64url):        WJ5_wo3_HIGzdP6UmVhUDQ / xhTe_hgaAFrJ2vFZ2FXuEVJEAZf4GkpFKZFp2nC-Qck
  transformed salt/hash:            WJ5/wo3/HIGzdP6UmVhUDQ== / 100000.xhTe/hgaAFrJ2vFZ2FXuEVJEAZf4GkpFKZFp2nC+Qck=
  portal self-verify:               true
  finder verify, correct password:  true
  finder verify, wrong password:    false
  finder verify, legacy bare hash:  true
  b64url-specific chars present:    true
  finder verify, UNtransformed:     false (expected false when url chars present)
trial 3:
  portal salt/hash (b64url):        AUpwkTgdbJAkIbBik518fQ / Z_MWuPYWK5hS3GoZZ6KD3ZiDielgAqAFGqFN1sHeeUc
  transformed salt/hash:            AUpwkTgdbJAkIbBik518fQ== / 100000.Z/MWuPYWK5hS3GoZZ6KD3ZiDielgAqAFGqFN1sHeeUc=
  portal self-verify:               true
  finder verify, correct password:  true
  finder verify, wrong password:    false
  finder verify, legacy bare hash:  true
  b64url-specific chars present:    true
  finder verify, UNtransformed:     false (expected false when url chars present)

RESULT: transform VERIFIED - portal hashes convert mechanically, no resets needed.
exit=0
```

**Verdict: the plan's claim holds empirically.** Three independent trials:
the transformed portal hash verifies true for the correct password and
false for a wrong one, on both the prefixed and the legacy bare-hash code
path. The untransformed values fail (the finder's `fromBase64` at
`src/auth.js:30-35` uses plain `atob`, which rejects `-`/`_`), which
proves the transform is genuinely required, not incidental. One build
note: the real import script must use the padded-base64 + prefix transform
above and should re-run this same self-test as a unit test
(PHASE3_PLAN step 6 already requires that).

---

## TASK 3: Tier backfill dry run

Rule under test (PHASE3_PLAN 2.1 / open question 8.1):
`member = 1 -> paid_access; else source = 'public' -> free; else
fully_managed`.

### 3.1 Local numbers (synthetic, mechanics only)

Against the seeded local DB the rule executes cleanly and produces:
`fully_managed = 3` (every seeded client has `member` unset and `source`
NULL), `paid_access = 0`, `free = 0`; edge flags: `source_null = 3`,
`paid_and_public = 0`, `archived = 0`, `portal_containers = 0`,
`trade_buyers = 0`. These numbers demonstrate the SQL, nothing more - the
seed has no tier variety by design (`seed/seed-dev.sql:1-16`).

### 3.2 Production SQL to get the real split (read-only)

```
npx wrangler d1 execute jdm-vehicle-finder --remote --json --command "
SELECT CASE WHEN member = 1 THEN 'paid_access'
            WHEN source = 'public' THEN 'free'
            ELSE 'fully_managed' END AS tier,
       COUNT(*) AS n
  FROM clients GROUP BY 1"
```

Edge and ambiguity flags (rows the rule catches but a human should
eyeball before sign-off):

```
npx wrangler d1 execute jdm-vehicle-finder --remote --json --command "
SELECT SUM(CASE WHEN source IS NULL THEN 1 ELSE 0 END)            AS source_null_legacy,
       SUM(CASE WHEN member = 1 AND source = 'public' THEN 1 ELSE 0 END) AS paid_and_public,
       SUM(archived)                                              AS archived_rows,
       SUM(CASE WHEN dealer_username IS NOT NULL THEN 1 ELSE 0 END) AS portal_containers,
       SUM(CASE WHEN category = 'dealer' THEN 1 ELSE 0 END)       AS trade_buyers,
       SUM(CASE WHEN portal_revoked = 1 THEN 1 ELSE 0 END)        AS revoked_rows,
       COUNT(*)                                                   AS total
  FROM clients"
```

And the full grid, if any bucket looks surprising:

```
npx wrangler d1 execute jdm-vehicle-finder --remote --json --command "
SELECT member, COALESCE(source, '(null)') AS source, category,
       CASE WHEN dealer_username IS NULL THEN 0 ELSE 1 END AS is_container,
       COUNT(*) AS n
  FROM clients GROUP BY 1, 2, 3, 4 ORDER BY n DESC"
```

### 3.3 Where the rule is ambiguous (flag counts to read closely)

- **`source IS NULL` legacy rows** fall to `fully_managed` (NULL is
  documented as legacy-jdm, `0016:1-4`). If `source_null_legacy` is large,
  that single default decides most of the backfill - confirm it matches
  reality before sign-off.
- **`paid_and_public`** (member = 1 AND source = 'public'): the rule sends
  them to `paid_access`, which is right - a public signup who subscribed.
  Expect small; verify not zero-sized by accident.
- **Portal container rows** (`dealer_username IS NOT NULL`): tier is
  meaningless for per-request containers. The rule as written sends them
  to `fully_managed`. Recommendation: the backfill should carve them out
  explicitly (leave tier at its default and let `dealer_user_id`
  ownership define them) so the fully_managed count is not inflated by
  non-people.
- **`archived` and `portal_revoked` rows** still receive a tier; harmless,
  but exclude them when reading the counts as "the customer base".
- **`trade_buyers`** (`category='dealer'`): the rule gives them a tier like
  anyone else, and the plan separately maps them to `type='dealer'`; check
  the overlap of `category='dealer'` with `member=1` in the grid so the
  Dealers tab of the future Users view is not accidentally split across
  tiers in a way that surprises.
