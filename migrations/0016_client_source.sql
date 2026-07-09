-- Where a client came from: 'public' = they submitted the request form / signed
-- in themselves; 'jdm' = staff or an agent added them. NULL (legacy rows) is
-- treated as 'jdm' in the UI, since historically staff added every client. Lets
-- the customer list separate self-submitted leads from managed clients without
-- fragmenting the data. Additive and non-destructive.
ALTER TABLE clients ADD COLUMN source TEXT;
