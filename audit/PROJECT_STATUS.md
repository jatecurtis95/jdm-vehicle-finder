# JDM Connect Finder, project status

**As at 23 July 2026.** Plain map of what was done today, what is live, what is
half-built, what still needs doing, and where every piece of code lives. Full
technical detail is in `audit/HANDOFF.md`.

## Where everything lives

| Thing | Location |
|---|---|
| Code, on your PC | `C:\Users\jatec\Projects\jdm-vehicle-finder` |
| Code, on GitHub | github.com/jatecurtis95/jdm-vehicle-finder |
| Live website | https://jdmfinder.com.au (Cloudflare Worker) |
| Production branch | `main` (pushing to it auto-deploys) |

**Live deploys today, in order** (each ID is a rollback point):
1. `2bb47937` , Phase 1+2 (filters, pricing, grades)
2. `9049c598` , Phase 5 (manual run-search)
3. `5f79bc7c` , Phase 4 (SMS, off by default)
4. `ab93603f` , free-tier teaser

Version live just before today: `31364596` (21 July).

## DONE and LIVE today

- **Phases 1+2 (`2bb47937`)** , shared auction filter panel on both tabs,
  multi-select houses, include-unspecified toggle; landed-cost defaults agency
  $1,500 / compliance $3,500; grades S,6,5,4.5,4,3.5,3,2,1,R,RA (grade 1 added).
  Files: `src/auction-history.js`, `auction-history-query.js`, `auction-ui.js`,
  `calc.js`, `wrangler.toml`.
- **Phase 5 (`9049c598`)** , manual "run this search now": staff route +
  rate-limited member "Check now" button; auto 4x/day unchanged. Files:
  `src/matcher.js`, `src/index.js`, `src/admin.js`; test `test/manual-run.test.mjs`.
- **Phase 4 SMS (`5f79bc7c`)** , SMS channel wired end to end, OFF by default.
  Files: `src/whatsapp.js`, `src/settings.js`, `src/notify.js`, `src/admin.js`;
  test `test/sms-channel.test.mjs`.
- **Free-tier teaser (`ab93603f`)** , free public sign-ups see "Match found" with
  the car locked behind an upgrade CTA (capped by `free_result_limit`). Managed
  and legacy clients unaffected (keyed on `member=0 AND source='public'`). Files:
  `src/admin.js`; test `test/free-tier-teaser.test.mjs`.
- **Housekeeping** , audit docs consolidated (`chore/audit-consolidation`); 37
  dead branches removed; migration tracking verified; rescue branch untouched.

## HALF-BUILT, on a branch, NOT live

- **Phase 3, users + tiers rebuild** (`feat/phase3-users-model`). Migration
  `migrations/0020_users_model.sql` written and rehearsed clean locally. Bulk
  sweep + agents-fold done. **334 of 589 tests passing.** Remaining: test-file
  data, dropped columns, member-to-tier logic, the separate dealer-portal repo,
  full rehearsal, then production cutover. Plan: `audit/PHASE3_PLAN_V2.md`. Not
  live because it is a large two-repo change ending in an irreversible database
  switch-over; will be finished to 100% green and cut over in a planned window.

## STILL TO DO (not started)

| Phase | What | Where |
|---|---|---|
| Phase 3 finish + cutover | Complete the rebuild, switch production over | `feat/phase3-users-model` |
| Phase 6 quotas | Per-tier request limits (folds into Phase 3) | with Phase 3 |
| Phase 7 | Calculator pricing made admin-editable | `C:\Users\jatec\repos\jdm-calculator` |
| Phase 8 | Consumer Make/Model/Variant view + 82-row queue | `rover-eligibility-local` |
| Phase 9 | Lead landing page (branch only) | greenfield, depends on 7+8 |

## What needs you

1. Admin password: already rotated (done).
2. Phase 3 cutover: give the go-ahead for a dedicated session to finish and cut
   over in a quiet window (one 2-second production email-collision check first,
   see `audit/PHASE3_CHECKS.md`).
3. SMS: add the Twilio SMS secrets and flip the Settings toggle to enable.
