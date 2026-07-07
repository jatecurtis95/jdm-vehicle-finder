-- V1.2 Phase 4: precise variant targeting on saved searches.
-- model_code: the feed's chassis/model code (kuzov), e.g. BNR32, 222058.
-- grades: JSON array of grade spellings the buyer accepts, OR-ed by the
-- matcher because auction houses spell the same real grade many ways.
ALTER TABLE wishlists ADD COLUMN model_code TEXT;
ALTER TABLE wishlists ADD COLUMN grades TEXT;
