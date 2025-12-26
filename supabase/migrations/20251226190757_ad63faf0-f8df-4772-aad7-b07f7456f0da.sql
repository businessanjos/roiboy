-- Add color column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS color text DEFAULT '#10b981';