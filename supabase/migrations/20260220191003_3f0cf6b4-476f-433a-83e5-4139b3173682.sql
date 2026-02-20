ALTER TABLE public.user_integrations
  DROP CONSTRAINT user_integrations_provider_check;

ALTER TABLE public.user_integrations
  ADD CONSTRAINT user_integrations_provider_check
  CHECK (provider = ANY (ARRAY['google', 'zoom', '3cplus']));