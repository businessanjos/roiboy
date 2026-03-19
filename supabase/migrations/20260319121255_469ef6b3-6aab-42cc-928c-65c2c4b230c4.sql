
-- Fix existing deals with NULL pipeline_id by deriving from their stage_id
UPDATE deals d
SET pipeline_id = ds.pipeline_id
FROM deal_stages ds
WHERE d.stage_id = ds.id
  AND d.pipeline_id IS NULL;

-- Prevent future orphaned deals: create a trigger to auto-fill pipeline_id from stage_id
CREATE OR REPLACE FUNCTION public.ensure_deal_pipeline_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If pipeline_id is null but stage_id is set, derive pipeline from stage
  IF NEW.pipeline_id IS NULL AND NEW.stage_id IS NOT NULL THEN
    SELECT pipeline_id INTO NEW.pipeline_id
    FROM public.deal_stages
    WHERE id = NEW.stage_id;
  END IF;
  
  -- If still null, assign Closer pipeline (or first active pipeline)
  IF NEW.pipeline_id IS NULL THEN
    SELECT id INTO NEW.pipeline_id
    FROM public.pipelines
    WHERE account_id = NEW.account_id
      AND is_active = true
    ORDER BY 
      CASE WHEN name ILIKE '%closer%' THEN 0 ELSE 1 END,
      display_order
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger for INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_ensure_deal_pipeline_id ON public.deals;
CREATE TRIGGER trg_ensure_deal_pipeline_id
  BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_deal_pipeline_id();
