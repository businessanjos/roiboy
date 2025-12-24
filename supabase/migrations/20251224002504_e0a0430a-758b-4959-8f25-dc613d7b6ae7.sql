-- Add unique constraint for account_id and type to support upsert
ALTER TABLE public.integrations 
ADD CONSTRAINT integrations_account_id_type_unique UNIQUE (account_id, type);