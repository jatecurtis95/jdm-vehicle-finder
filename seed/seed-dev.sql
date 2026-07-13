-- seed-dev.sql  (DEVELOPMENT ONLY)
--
-- Sample data so the app can be exercised locally without touching any real
-- customer records. Every name, email and number here is fabricated. Apply ONLY
-- to a local database:
--
--   npm run db:seed:local
--
-- Never run this against the remote/production database. The rows use a high id
-- range (9000+) and INSERT OR REPLACE so re-seeding is repeatable and will not
-- collide with real auto-increment ids.
--
-- Dev logins created by this seed (password for both: demo1234):
--   Agent:  demo.agent@example.com
--   Buyer:  demo.buyer@example.com   (buyer portal at /portal)
-- Admin login is the ADMIN_PASSWORD secret (blank email), not seeded here.

-- Agents -------------------------------------------------------------------
-- 9001 has a working password; 9002 is in the invited state (no password yet).
INSERT OR REPLACE INTO agents (id, email, name, pass_salt, pass_hash, active, alerts, company) VALUES
  (9001, 'demo.agent@example.com', 'Demo Agent', 'Z/BWEBau6M4vcJs5hitPwQ==', 'QHirASmhIRYnd6NXnoFv9jo6JuP/hOw/1AU3A1Q0I1M=', 1, 1, 'Ofuka Demo'),
  (9002, 'invited.agent@example.com', 'Invited Agent', '', '', 1, 1, NULL);

-- Dealer account -----------------------------------------------------------
-- Uses the same QA-only demo password as the agent and buyer: demo1234.
INSERT OR REPLACE INTO dealers (id, email, name, company, state, pass_salt, pass_hash, active) VALUES
  (9001, 'demo.dealer@example.com', 'Demo Dealer', 'Tokyo Demo Cars', 'WA', 'Z/BWEBau6M4vcJs5hitPwQ==', 'QHirASmhIRYnd6NXnoFv9jo6JuP/hOw/1AU3A1Q0I1M=', 1);

INSERT OR REPLACE INTO dealer_vehicles (id, dealer_id, make, model, year, grade, mileage_km, price_aud, location, description, status) VALUES
  (9001, 9001, 'NISSAN', 'SKYLINE', 1999, '4.5', 62000, 89500, 'Perth WA', 'Fabricated QA submission for responsive dealer-page checks.', 'pending');

-- Clients ------------------------------------------------------------------
-- 9001 owned by the demo agent, portal enabled with a working login.
-- 9002 owned by the demo agent, no portal. 9003 is a JDM Connect direct client.
INSERT OR REPLACE INTO clients (id, name, email, whatsapp, state, agent_id, portal_enabled, pass_salt, pass_hash) VALUES
  (9001, 'Aiko Tanaka', 'demo.buyer@example.com', '+61400000001', 'VIC', 9001, 1, '735Tli9Zbw8K+vQ6lwBG2A==', 'fEIhbrdwNGkaDNtkMNUDrtSeTtgMAZIt7kA2JlUX6d0='),
  (9002, 'Ben Carter', 'ben.demo@example.com', NULL, 'NSW', 9001, 0, NULL, NULL),
  (9003, 'Direct Buyer', NULL, '+61400000003', 'QLD', NULL, 0, NULL, NULL);

-- Wishlists ----------------------------------------------------------------
INSERT OR REPLACE INTO wishlists (id, client_id, label, marka_name, model_name, year_min, year_max, price_max, rate_min, kuzov, active, watch_only) VALUES
  (9001, 9001, 'R34 GT-R', 'NISSAN', 'SKYLINE', 1999, 2002, 12000000, 4, 'BNR34', 1, 0),
  (9002, 9002, 'A80 Supra', 'TOYOTA', 'SUPRA', 1993, 2002, 9000000, 4, 'JZA80', 1, 0),
  (9003, 9003, 'FD RX-7 watch', 'MAZDA', 'RX-7', 1991, 2002, 6000000, 3.5, 'FD3S', 1, 1);

-- Queue (matches) ----------------------------------------------------------
-- Two 'sent' cars for the portal-enabled buyer (one already requested), and one
-- 'pending' match for the staff Matches view. Auction dates are in the future so
-- the expiry sweep keeps them visible. Aiko's sends are 20 days old with one
-- opened and marked interested, so she exercises the dashboard's gone-quiet
-- list (engaged buyer, no touch in 14+ days).
INSERT OR REPLACE INTO queue (id, wishlist_id, client_id, lot_id, lot_json, status, token, client_request, decided_at, created_at, sent_at, viewed_at, response) VALUES
  (9001, 9001, 9001, 'SEED-LOT-1',
   '{"id":"SEED-LOT-1","lot":"40123","marka_name":"NISSAN","model_name":"SKYLINE","year":2000,"rate":"4.5","start":8500000,"avg_price":9200000,"mileage":62000,"kuzov":"BNR34","color":"SILVER","eng_v":2600,"auction":"USS Tokyo","auction_date":"2027-12-20 10:00:00","images":"","_landed":{"grandTotal":118500,"state":"VIC"}}',
   'sent', 'seedtoken0001', 1, datetime('now','-20 days'), datetime('now','-21 days'), datetime('now','-20 days'), datetime('now','-20 days'), 'interested'),
  (9002, 9001, 9001, 'SEED-LOT-2',
   '{"id":"SEED-LOT-2","lot":"40688","marka_name":"NISSAN","model_name":"SKYLINE","year":1999,"rate":"4","start":7800000,"avg_price":8100000,"mileage":88000,"kuzov":"BNR34","color":"WHITE","eng_v":2600,"auction":"TAA Kinki","auction_date":"2027-12-22 10:00:00","images":"","_landed":{"grandTotal":109900,"state":"VIC"}}',
   'sent', 'seedtoken0002', 0, NULL, datetime('now','-21 days'), datetime('now','-20 days'), NULL, NULL),
  (9003, 9002, 9002, 'SEED-LOT-3',
   '{"id":"SEED-LOT-3","lot":"51220","marka_name":"TOYOTA","model_name":"SUPRA","year":1997,"rate":"4.5","start":6900000,"avg_price":7300000,"mileage":74000,"kuzov":"JZA80","color":"BLACK","eng_v":3000,"auction":"USS Nagoya","auction_date":"2027-12-28 10:00:00","images":"","_landed":{"grandTotal":98750,"state":"NSW"}}',
   'pending', 'seedtoken0003', 0, NULL, datetime('now'), NULL, NULL, NULL);

-- Settings: keep dev safe by default. MAIL_DRY_RUN is an env var, not a setting,
-- but make sure deposits are off in any seeded local database.
INSERT OR REPLACE INTO settings (key, value) VALUES ('stripe_enabled', '0');
-- The dealer feature ships hidden in production (launch audit) but stays ON in
-- dev/QA seeds so the dealer admin views and smoke tests keep exercising it.
INSERT OR REPLACE INTO settings (key, value) VALUES ('dealer_portal_enabled', '1');
