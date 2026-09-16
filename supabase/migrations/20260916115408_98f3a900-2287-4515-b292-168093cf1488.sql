DROP INDEX IF EXISTS public.uq_zapp_message_reactions_msg_reactor;
UPDATE public.zapp_message_reactions SET reactor_phone = 'unknown' WHERE reactor_phone IS NULL;
ALTER TABLE public.zapp_message_reactions ALTER COLUMN reactor_phone SET DEFAULT 'unknown';
ALTER TABLE public.zapp_message_reactions ALTER COLUMN reactor_phone SET NOT NULL;
CREATE UNIQUE INDEX uq_zapp_message_reactions_msg_reactor
  ON public.zapp_message_reactions (zapp_message_id, reactor_phone);