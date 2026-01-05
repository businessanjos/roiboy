-- Migrate data from marketing_events to events
INSERT INTO public.events (
  account_id,
  title,
  description,
  event_type,
  scheduled_at,
  ends_at,
  budget,
  status,
  category,
  color,
  goals,
  notes,
  start_time,
  end_time,
  created_at,
  updated_at
)
SELECT 
  account_id,
  title,
  description,
  event_type::public.event_type,
  (start_date || ' 00:00:00')::timestamp with time zone,
  CASE WHEN end_date IS NOT NULL THEN (end_date || ' 23:59:59')::timestamp with time zone ELSE NULL END,
  budget,
  status,
  'marketing'::public.event_category,
  color,
  goals,
  notes,
  start_time,
  end_time,
  created_at,
  updated_at
FROM public.marketing_events;

-- Drop marketing_events table (data migrated)
DROP TABLE IF EXISTS public.marketing_events;