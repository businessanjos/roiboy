-- Fix the Security Definer View issue
-- The events_checkin_view doesn't need SECURITY DEFINER - it should use SECURITY INVOKER (default)
-- Recreate the view with explicit security settings

DROP VIEW IF EXISTS public.events_checkin_view;

-- Recreate with SECURITY INVOKER (explicit, though it's the default)
CREATE VIEW public.events_checkin_view 
WITH (security_invoker = on)
AS 
SELECT id,
    account_id,
    title,
    modality,
    address,
    scheduled_at
FROM public.events
WHERE checkin_code IS NOT NULL 
  AND modality = 'presencial'::event_modality;