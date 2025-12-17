-- Add contract date fields to clients table
ALTER TABLE public.clients
ADD COLUMN contract_start_date date,
ADD COLUMN contract_end_date date;