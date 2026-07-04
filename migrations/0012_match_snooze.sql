-- IA-AUDIT item 12: match snooze. A pending match can be deferred (revisit
-- tomorrow, or 24h before the auction closes) without polluting the Awaiting
-- review counts the dashboard treats as workload. NULL or a past timestamp
-- means live; a future timestamp hides the row from pending surfaces until due.
ALTER TABLE queue ADD COLUMN snoozed_until TEXT;
