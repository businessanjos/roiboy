
ALTER TABLE public.client_life_events DROP CONSTRAINT IF EXISTS client_life_events_event_type_check;
ALTER TABLE public.client_life_events ADD CONSTRAINT client_life_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'birthday','child_birth','pregnancy','wedding','anniversary','graduation',
    'new_job','promotion','retirement','health_issue','loss','travel',
    'achievement','other','instagram_metrics'
  ]));

ALTER TABLE public.client_life_events DROP CONSTRAINT IF EXISTS client_life_events_source_check;
ALTER TABLE public.client_life_events ADD CONSTRAINT client_life_events_source_check
  CHECK (source = ANY (ARRAY['manual','conversation','system']));
