-- One-off import of JDM's manually-tracked customers and their searches
-- (from the July 2026 tracking sheet). Every statement is idempotent: a client
-- is only created if one with the same name and this import marker does not
-- already exist, and a search is only added if that client does not already
-- have one with the same label. Safe to run more than once.
--
-- Mapping notes:
--   * "FOB Budget" (yen auction price) -> wishlists.price_max (JPY).
--   * Letter grades (4B+, 3.5C+ ...) -> numeric rate_min; the letter and any
--     colour/trim/condition preferences live in the label / client notes.
--   * "25+ years old" (import eligibility) -> a year_max of 2001.
--   * Chassis/model codes -> wishlists.model_code (the matcher's strong filter).
-- All records are owned by the house account (agent_id NULL) and tagged in
-- notes as imported, so they are easy to find or bulk-tag later.

-- ---- Clients -------------------------------------------------------------

INSERT INTO users (name, category, notes)
SELECT 'Jane', 'private', 'Imported from JDM tracking sheet (2026-07)'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='Jane' AND notes LIKE 'Imported from JDM tracking sheet%');
INSERT INTO users (name, category, notes)
SELECT 'Ashleigh', 'private', 'Imported from JDM tracking sheet (2026-07)'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='Ashleigh' AND notes LIKE 'Imported from JDM tracking sheet%');
INSERT INTO users (name, category, notes)
SELECT 'Matt', 'dealer', 'Imported from JDM tracking sheet (2026-07)'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='Matt' AND notes LIKE 'Imported from JDM tracking sheet%');
INSERT INTO users (name, category, notes)
SELECT 'Geert', 'dealer', 'Imported from JDM tracking sheet (2026-07)'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='Geert' AND notes LIKE 'Imported from JDM tracking sheet%');
INSERT INTO users (name, category, notes)
SELECT 'Jared', 'private', 'Imported from JDM tracking sheet (2026-07)'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='Jared' AND notes LIKE 'Imported from JDM tracking sheet%');
INSERT INTO users (name, category, notes)
SELECT 'Benji', 'private', 'Imported from JDM tracking sheet (2026-07)'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='Benji' AND notes LIKE 'Imported from JDM tracking sheet%');
INSERT INTO users (name, category, notes)
SELECT 'Nathan', 'private', 'Imported from JDM tracking sheet (2026-07)'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='Nathan' AND notes LIKE 'Imported from JDM tracking sheet%');
INSERT INTO users (name, category, notes)
SELECT 'Ahtesham', 'private', 'Imported from JDM tracking sheet (2026-07)'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='Ahtesham' AND notes LIKE 'Imported from JDM tracking sheet%');
INSERT INTO users (name, category, notes)
SELECT 'Jake', 'private', 'Imported from JDM tracking sheet (2026-07)'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='Jake' AND notes LIKE 'Imported from JDM tracking sheet%');
INSERT INTO users (name, category, notes)
SELECT 'Kelly', 'private', 'Imported from JDM tracking sheet (2026-07)'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='Kelly' AND notes LIKE 'Imported from JDM tracking sheet%');
INSERT INTO users (name, category, notes)
SELECT 'Josh', 'private', 'Imported from JDM tracking sheet (2026-07)'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='Josh' AND notes LIKE 'Imported from JDM tracking sheet%');
INSERT INTO users (name, category, notes)
SELECT 'Owain', 'private', 'Imported from JDM tracking sheet (2026-07)'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='Owain' AND notes LIKE 'Imported from JDM tracking sheet%');
INSERT INTO users (name, category, notes)
SELECT 'Hamish', 'private', 'Imported from JDM tracking sheet (2026-07)'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='Hamish' AND notes LIKE 'Imported from JDM tracking sheet%');
INSERT INTO users (name, category, notes)
SELECT 'Ryan O', 'private', 'Imported from JDM tracking sheet (2026-07)'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='Ryan O' AND notes LIKE 'Imported from JDM tracking sheet%');
INSERT INTO users (name, category, notes)
SELECT 'Sean', 'private', 'Imported from JDM tracking sheet (2026-07)'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='Sean' AND notes LIKE 'Imported from JDM tracking sheet%');
INSERT INTO users (name, category, notes)
SELECT 'Ali', 'private', 'Imported from JDM tracking sheet (2026-07)'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name='Ali' AND notes LIKE 'Imported from JDM tracking sheet%');

-- ---- Searches (wishlists) ------------------------------------------------
-- Each links to its client by name + import marker, and is skipped if a search
-- with the same label already exists for that client.

INSERT INTO searches (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, model_code, active)
SELECT c.id, 'Hiace GDH206 4WD diesel', 'Toyota', 'Hiace', 2019, 2024, 2500000, NULL, NULL, 'GDH206', 1
FROM users c WHERE c.name='Jane' AND c.notes LIKE 'Imported from JDM tracking sheet%'
  AND NOT EXISTS (SELECT 1 FROM searches w WHERE w.client_id=c.id AND w.label='Hiace GDH206 4WD diesel');

INSERT INTO searches (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, model_code, active)
SELECT c.id, 'Aqua MXPK11', 'Toyota', 'Aqua', 2021, 2025, NULL, 80000, NULL, 'MXPK11', 1
FROM users c WHERE c.name='Ashleigh' AND c.notes LIKE 'Imported from JDM tracking sheet%'
  AND NOT EXISTS (SELECT 1 FROM searches w WHERE w.client_id=c.id AND w.label='Aqua MXPK11');

INSERT INTO searches (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, model_code, active)
SELECT c.id, 'Crown Hybrid ASZH20', 'Toyota', 'Crown', 2019, 2020, NULL, 130000, 4, 'ASZH20', 1
FROM users c WHERE c.name='Matt' AND c.notes LIKE 'Imported from JDM tracking sheet%'
  AND NOT EXISTS (SELECT 1 FROM searches w WHERE w.client_id=c.id AND w.label='Crown Hybrid ASZH20');

INSERT INTO searches (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, model_code, active)
SELECT c.id, 'Jimny JB64W', 'Suzuki', 'Jimny', 2020, 2024, 1400000, 80000, 4, 'JB64W', 1
FROM users c WHERE c.name='Geert' AND c.notes LIKE 'Imported from JDM tracking sheet%'
  AND NOT EXISTS (SELECT 1 FROM searches w WHERE w.client_id=c.id AND w.label='Jimny JB64W');

INSERT INTO searches (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, model_code, active)
SELECT c.id, 'Jimny JA22 (Wild Winds, manual)', 'Suzuki', 'Jimny', NULL, NULL, NULL, NULL, 3.5, 'JA22', 1
FROM users c WHERE c.name='Jared' AND c.notes LIKE 'Imported from JDM tracking sheet%'
  AND NOT EXISTS (SELECT 1 FROM searches w WHERE w.client_id=c.id AND w.label='Jimny JA22 (Wild Winds, manual)');

INSERT INTO searches (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, model_code, active)
SELECT c.id, 'Hilux Surf 1995-2001', 'Toyota', 'Hilux Surf', 1995, 2001, NULL, 200000, 3.5, NULL, 1
FROM users c WHERE c.name='Benji' AND c.notes LIKE 'Imported from JDM tracking sheet%'
  AND NOT EXISTS (SELECT 1 FROM searches w WHERE w.client_id=c.id AND w.label='Hilux Surf 1995-2001');

INSERT INTO searches (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, model_code, active)
SELECT c.id, 'Impreza STI S203 (exact GDBE4EH)', 'Subaru', 'Impreza', 2005, NULL, NULL, NULL, NULL, 'GDBE4EH', 1
FROM users c WHERE c.name='Nathan' AND c.notes LIKE 'Imported from JDM tracking sheet%'
  AND NOT EXISTS (SELECT 1 FROM searches w WHERE w.client_id=c.id AND w.label='Impreza STI S203 (exact GDBE4EH)');

INSERT INTO searches (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, model_code, active)
SELECT c.id, 'S-Class S400 Hybrid 222057', 'Mercedes', 'S Class', 2016, 2017, NULL, 60000, 4, '222057', 1
FROM users c WHERE c.name='Ahtesham' AND c.notes LIKE 'Imported from JDM tracking sheet%'
  AND NOT EXISTS (SELECT 1 FROM searches w WHERE w.client_id=c.id AND w.label='S-Class S400 Hybrid 222057');

INSERT INTO searches (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, model_code, active)
SELECT c.id, 'S15 Spec R (manual turbo, 25yr)', 'Nissan', 'Silvia', NULL, 2001, NULL, NULL, NULL, 'S15', 1
FROM users c WHERE c.name='Jake' AND c.notes LIKE 'Imported from JDM tracking sheet%'
  AND NOT EXISTS (SELECT 1 FROM searches w WHERE w.client_id=c.id AND w.label='S15 Spec R (manual turbo, 25yr)');

INSERT INTO searches (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, model_code, active)
SELECT c.id, 'R34 Skyline ER34 (Bayside Blue, GTR kit)', 'Nissan', 'Skyline', NULL, 2001, NULL, 200000, 3.5, 'ER34', 1
FROM users c WHERE c.name='Jake' AND c.notes LIKE 'Imported from JDM tracking sheet%'
  AND NOT EXISTS (SELECT 1 FROM searches w WHERE w.client_id=c.id AND w.label='R34 Skyline ER34 (Bayside Blue, GTR kit)');

INSERT INTO searches (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, model_code, active)
SELECT c.id, 'Laurel C33 (1990+, manual or auto)', 'Nissan', 'Laurel', 1990, NULL, NULL, NULL, NULL, 'C33', 1
FROM users c WHERE c.name='Kelly' AND c.notes LIKE 'Imported from JDM tracking sheet%'
  AND NOT EXISTS (SELECT 1 FROM searches w WHERE w.client_id=c.id AND w.label='Laurel C33 (1990+, manual or auto)');

INSERT INTO searches (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, model_code, active)
SELECT c.id, 'Evo 8 GSR/MR CT9A', 'Mitsubishi', 'Lancer', 2003, 2004, NULL, 100000, 4, 'CT9A', 1
FROM users c WHERE c.name='Josh' AND c.notes LIKE 'Imported from JDM tracking sheet%'
  AND NOT EXISTS (SELECT 1 FROM searches w WHERE w.client_id=c.id AND w.label='Evo 8 GSR/MR CT9A');

INSERT INTO searches (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, model_code, active)
SELECT c.id, 'Landcruiser 100 UZJ100W (petrol 4.7)', 'Toyota', 'Land Cruiser', NULL, 2001, NULL, NULL, NULL, 'UZJ100W', 1
FROM users c WHERE c.name='Owain' AND c.notes LIKE 'Imported from JDM tracking sheet%'
  AND NOT EXISTS (SELECT 1 FROM searches w WHERE w.client_id=c.id AND w.label='Landcruiser 100 UZJ100W (petrol 4.7)');

INSERT INTO searches (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, model_code, active)
SELECT c.id, 'Autozam AZ-1 (Mazdaspeed)', 'Mazda', 'AZ-1', NULL, NULL, NULL, NULL, NULL, 'PG6SA', 1
FROM users c WHERE c.name='Hamish' AND c.notes LIKE 'Imported from JDM tracking sheet%'
  AND NOT EXISTS (SELECT 1 FROM searches w WHERE w.client_id=c.id AND w.label='Autozam AZ-1 (Mazdaspeed)');

INSERT INTO searches (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, model_code, active)
SELECT c.id, 'Mitsubishi Jeep J53/J54 (turbo)', 'Mitsubishi', 'Jeep', 1990, 1997, NULL, NULL, 3.5, 'J5', 1
FROM users c WHERE c.name='Ryan O' AND c.notes LIKE 'Imported from JDM tracking sheet%'
  AND NOT EXISTS (SELECT 1 FROM searches w WHERE w.client_id=c.id AND w.label='Mitsubishi Jeep J53/J54 (turbo)');

INSERT INTO searches (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, model_code, active)
SELECT c.id, 'Mark II JZX100 Tourer V (manual)', 'Toyota', 'Mark II', NULL, NULL, NULL, NULL, NULL, 'JZX100', 1
FROM users c WHERE c.name='Sean' AND c.notes LIKE 'Imported from JDM tracking sheet%'
  AND NOT EXISTS (SELECT 1 FROM searches w WHERE w.client_id=c.id AND w.label='Mark II JZX100 Tourer V (manual)');

INSERT INTO searches (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, model_code, active)
SELECT c.id, 'Chaser JZX100 Tourer V (manual)', 'Toyota', 'Chaser', NULL, NULL, NULL, NULL, NULL, 'JZX100', 1
FROM users c WHERE c.name='Sean' AND c.notes LIKE 'Imported from JDM tracking sheet%'
  AND NOT EXISTS (SELECT 1 FROM searches w WHERE w.client_id=c.id AND w.label='Chaser JZX100 Tourer V (manual)');

INSERT INTO searches (client_id, label, marka_name, model_name, year_min, year_max, price_max, mileage_max, rate_min, model_code, active)
SELECT c.id, 'GT-R R35 (up to 02/2009)', 'Nissan', 'GT-R', NULL, 2009, 7500000, NULL, NULL, 'R35', 1
FROM users c WHERE c.name='Ali' AND c.notes LIKE 'Imported from JDM tracking sheet%'
  AND NOT EXISTS (SELECT 1 FROM searches w WHERE w.client_id=c.id AND w.label='GT-R R35 (up to 02/2009)');
