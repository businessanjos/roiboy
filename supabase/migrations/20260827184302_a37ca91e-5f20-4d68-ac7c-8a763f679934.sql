ALTER TABLE public.zapp_ruler_template_steps ADD COLUMN IF NOT EXISTS is_task boolean NOT NULL DEFAULT false;
ALTER TABLE public.zapp_ruler_touches ADD COLUMN IF NOT EXISTS is_task boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.claim_zapp_ruler_touches(p_limit integer DEFAULT 50)
RETURNS SETOF public.zapp_ruler_touches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.zapp_ruler_touches t
     SET claimed_at = now(),
         attempts = t.attempts + 1,
         updated_at = now()
   WHERE t.id IN (
     SELECT tt.id
       FROM public.zapp_ruler_touches tt
       JOIN public.zapp_ruler_enrollments e ON e.id = tt.enrollment_id
      WHERE tt.status = 'pending'
        AND tt.auto_send = true
        AND tt.is_task = false
        AND tt.scheduled_at <= now()
        AND tt.attempts < 5
        AND e.status = 'active'
      ORDER BY tt.scheduled_at
      LIMIT p_limit
      FOR UPDATE OF tt SKIP LOCKED
   )
  RETURNING t.*;
END;
$$;