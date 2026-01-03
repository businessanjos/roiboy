-- Add trade_name (Nome Fantasia) column to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN trade_name text;