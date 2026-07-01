-- 0007_destination_next_action.sql
-- Two small, additive request fields:
--  * destination_country: a lightweight "overseas" flag on a request. Empty/NULL
--    means the default market (Australia); any value means the car is being
--    imported to that country and needs manual, non-AU handling. We deliberately
--    do NOT branch the landed-cost / eligibility flow on it - it's just a marker.
--  * next_action_date / next_action_note: a scheduled follow-up per request, so
--    the dashboard can answer "who needs attention today?" from real dates rather
--    than only inferring from last activity.
-- All additive and non-destructive; existing rows default to NULL (Australia, no
-- scheduled action).
ALTER TABLE wishlists ADD COLUMN destination_country TEXT;
ALTER TABLE wishlists ADD COLUMN next_action_date TEXT;   -- ISO date (YYYY-MM-DD)
ALTER TABLE wishlists ADD COLUMN next_action_note TEXT;
CREATE INDEX IF NOT EXISTS idx_wishlists_next_action ON wishlists(next_action_date);
