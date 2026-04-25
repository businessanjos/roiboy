-- 1) Adicionar valores oficiais ao enum (idempotente)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'member';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';