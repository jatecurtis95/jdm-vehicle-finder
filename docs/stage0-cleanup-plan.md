# Stage 0 production cleanup plan (for approval, not yet run)

Two cleanups are proposed against the live database. Neither has been run. Each
starts with a read-only SELECT so you can eyeball exactly what would change
before any delete. Run the SELECTs yourself, confirm the rows look right, then
approve the change and I will run the gated step (or you can).

All commands target the remote database explicitly:

```
npx wrangler d1 execute jdm-vehicle-finder --remote --command "<SQL>"
```

Take a backup first (export current state):

```
npx wrangler d1 export jdm-vehicle-finder --remote --output backup-before-cleanup.sql
```

---

## 1. Remove test records (for example "QA Test 5")

### Step 1a. Find them (read-only)

```sql
SELECT id, name, email, whatsapp, agent_id, created_at
FROM clients
WHERE name LIKE '%test%' COLLATE NOCASE
   OR name LIKE 'QA %' COLLATE NOCASE
   OR email LIKE '%example.com'
   OR email LIKE '%test%'
ORDER BY id;
```

Review the list. Note the ids that are genuinely test data. Do not assume: a
real customer could have "test drive" in a note. Decide on the exact id list,
for example `(101, 102, 103)`.

### Step 1b. See what hangs off them (read-only)

```sql
SELECT 'wishlists' AS tbl, COUNT(*) FROM wishlists WHERE client_id IN (/* ids */)
UNION ALL SELECT 'queue', COUNT(*) FROM queue WHERE client_id IN (/* ids */)
UNION ALL SELECT 'payments', COUNT(*) FROM payments WHERE client_id IN (/* ids */)
UNION ALL SELECT 'shares', COUNT(*) FROM client_shares WHERE client_id IN (/* ids */);
```

If `payments` is non-zero for any id, stop and review by hand. We do not delete a
client who has a real payment row.

### Step 1c. Delete (gated, run only after you approve the id list)

```sql
DELETE FROM seen_lots WHERE wishlist_id IN (SELECT id FROM wishlists WHERE client_id IN (/* ids */));
DELETE FROM queue        WHERE client_id IN (/* ids */);
DELETE FROM wishlists    WHERE client_id IN (/* ids */);
DELETE FROM client_shares WHERE client_id IN (/* ids */);
DELETE FROM clients      WHERE id IN (/* ids */);
```

---

## 2. Clients with no contact channel

New clients now require an email or a WhatsApp number (Stage 0.5). Existing rows
were left untouched. These cannot be sent a match, so any match reviewed for them
is wasted effort.

### Step 2a. Find them (read-only)

```sql
SELECT id, name, agent_id, created_at,
       (SELECT COUNT(*) FROM wishlists w WHERE w.client_id = c.id) AS wishlists,
       (SELECT COUNT(*) FROM queue q WHERE q.client_id = c.id AND q.status = 'pending') AS pending_matches
FROM clients c
WHERE (email IS NULL OR TRIM(email) = '')
  AND (whatsapp IS NULL OR TRIM(whatsapp) = '')
ORDER BY pending_matches DESC, id;
```

### Step 2b. Proposed remediation (no destructive default)

These are real leads, so the default is not to delete. Recommended order:

1. For any row with `pending_matches > 0`, the owning agent should add a contact
   channel (chase the buyer) so the queued matches can actually be sent.
2. For rows with no wishlists and no activity that are clearly stale, archive or
   delete them using the same dependent-row pattern as section 1c, but only after
   the owning agent confirms.

No bulk update or delete is proposed here without a per-row decision. If you want,
I can add an admin view that lists contactless clients with an inline "add
contact" form so this is handled in the UI rather than by SQL.

---

## Notes

- Nothing in this document runs automatically. Each delete is gated on your
  approval of a specific id list.
- The historical one-off data fixes under `migrations/legacy/` (the
  `migrate-dedupe-*.sql` files) are already applied and are kept only for history.
  Do not re-run them.
