ALTER TABLE public.products ADD COLUMN IF NOT EXISTS allows_second_seat boolean NOT NULL DEFAULT false;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS has_second_seat boolean NOT NULL DEFAULT false;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS second_seat_name text;