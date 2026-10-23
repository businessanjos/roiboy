ALTER TABLE public.zapp_sequence_run_steps ADD COLUMN IF NOT EXISTS delay_seconds integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.playbook_sequence_steps.delay_seconds IS 'Seconds to wait BEFORE this step, counted from the previous step actual send; step 0 is always instant';
WITH shifted AS (
  SELECT id, COALESCE(LAG(delay_seconds) OVER (PARTITION BY sequence_id ORDER BY position), 0) AS nd
  FROM public.playbook_sequence_steps
)
UPDATE public.playbook_sequence_steps s SET delay_seconds = shifted.nd FROM shifted WHERE shifted.id = s.id;