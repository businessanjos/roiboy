-- Add MLS fields to products table
ALTER TABLE public.products
ADD COLUMN is_mls boolean NOT NULL DEFAULT false,
ADD COLUMN mls_level text NULL;

-- Add check constraint for valid MLS levels
ALTER TABLE public.products
ADD CONSTRAINT valid_mls_level CHECK (
  mls_level IS NULL OR mls_level IN ('bronze', 'prata', 'ouro', 'diamond', 'platinum')
);