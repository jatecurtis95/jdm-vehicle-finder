-- 0014_wishlist_budget_aud.sql
-- V1.2 Phase 2: the public wizard collects the budget in AUD (on-road) and
-- shows a live yen equivalent; the wishlist now stores BOTH figures. price_max
-- (JPY) stays exactly what the matcher filters on today; budget_aud is the
-- buyer's own number, kept for staff context and future re-conversion.
-- Additive and non-destructive.
ALTER TABLE wishlists ADD COLUMN budget_aud INTEGER;
