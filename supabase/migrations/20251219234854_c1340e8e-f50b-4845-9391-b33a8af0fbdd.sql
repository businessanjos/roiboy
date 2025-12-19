-- Add asaas_customer_id column to accounts table
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS asaas_customer_id text;