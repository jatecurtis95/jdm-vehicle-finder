-- Minimum mileage on a saved search, mirroring the existing mileage_max. Lets a
-- buyer exclude implausibly-low / likely-wound-back odometers (or require a
-- worked-in example). The matcher adds `mileage >= mileage_min` when it is set.
-- Additive and non-destructive.
ALTER TABLE wishlists ADD COLUMN mileage_min INTEGER;
