-- Add stage_changed_at column
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz DEFAULT now();

-- Backfill: set stage_changed_at = updated_at for existing deals
UPDATE public.deals SET stage_changed_at = updated_at WHERE stage_changed_at IS NULL;

-- Trigger to auto-update stage_changed_at when stage_id changes
CREATE OR REPLACE FUNCTION public.update_deal_stage_changed_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    NEW.stage_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deal_stage_changed_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_deal_stage_changed_at();