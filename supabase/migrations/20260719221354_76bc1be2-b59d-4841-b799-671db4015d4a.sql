
ALTER TABLE public.installment_events DROP CONSTRAINT IF EXISTS installment_events_visible_to_check;
ALTER TABLE public.installment_events ADD CONSTRAINT installment_events_visible_to_check
  CHECK (visible_to = ANY (ARRAY['sales','ops','finance','all','internal']));
