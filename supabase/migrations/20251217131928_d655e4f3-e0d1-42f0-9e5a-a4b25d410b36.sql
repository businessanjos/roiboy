-- Add new values to user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'cx';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'cs';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'consultor';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'head';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'gestor';