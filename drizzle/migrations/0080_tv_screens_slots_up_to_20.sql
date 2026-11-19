ALTER TABLE public.tv_screens DROP CONSTRAINT tv_screens_slot_check;
ALTER TABLE public.tv_screens ADD CONSTRAINT tv_screens_slot_check CHECK (slot >= 1 AND slot <= 20);