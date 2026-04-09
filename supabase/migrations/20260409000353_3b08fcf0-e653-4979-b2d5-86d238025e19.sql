
CREATE OR REPLACE FUNCTION public.enforce_sdr_pipeline_routing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_george_id UUID := 'cefc44c7-d2e2-4937-94ac-069c1c94731b';
  v_sdr_pipeline_id UUID := 'f2de0548-1d92-4617-8397-3962c7adbaa5';
  v_closer_pipeline_id UUID := '4a96159e-c6a2-432f-8128-9ac345e58c18';
  v_target_stage_id UUID;
  v_current_stage_name TEXT;
BEGIN
  -- CASE 1: George is the responsible → force deal into SDR pipeline
  IF NEW.responsible_user_id = v_george_id AND NEW.pipeline_id IS DISTINCT FROM v_sdr_pipeline_id THEN
    -- Try to find a matching stage name in SDR pipeline
    IF NEW.stage_id IS NOT NULL THEN
      SELECT name INTO v_current_stage_name
      FROM deal_stages WHERE id = NEW.stage_id;

      SELECT id INTO v_target_stage_id
      FROM deal_stages
      WHERE pipeline_id = v_sdr_pipeline_id AND name = v_current_stage_name
      LIMIT 1;
    END IF;

    -- Fallback to first stage of SDR pipeline
    IF v_target_stage_id IS NULL THEN
      SELECT id INTO v_target_stage_id
      FROM deal_stages
      WHERE pipeline_id = v_sdr_pipeline_id
      ORDER BY display_order ASC
      LIMIT 1;
    END IF;

    NEW.pipeline_id := v_sdr_pipeline_id;
    NEW.stage_id := v_target_stage_id;

    -- Ensure sdr_user_id is set to George
    IF NEW.sdr_user_id IS NULL THEN
      NEW.sdr_user_id := v_george_id;
    END IF;

    RETURN NEW;
  END IF;

  -- CASE 2: Responsible changed FROM George to someone else → move to Closer pipeline
  IF TG_OP = 'UPDATE'
     AND OLD.responsible_user_id = v_george_id
     AND NEW.responsible_user_id IS DISTINCT FROM v_george_id
     AND NEW.pipeline_id = v_sdr_pipeline_id
  THEN
    -- Try to find a matching stage name in Closer pipeline
    IF NEW.stage_id IS NOT NULL THEN
      SELECT name INTO v_current_stage_name
      FROM deal_stages WHERE id = NEW.stage_id;

      v_target_stage_id := NULL;
      SELECT id INTO v_target_stage_id
      FROM deal_stages
      WHERE pipeline_id = v_closer_pipeline_id AND name = v_current_stage_name
      LIMIT 1;
    END IF;

    -- Fallback to first stage of Closer pipeline
    IF v_target_stage_id IS NULL THEN
      SELECT id INTO v_target_stage_id
      FROM deal_stages
      WHERE pipeline_id = v_closer_pipeline_id
      ORDER BY display_order ASC
      LIMIT 1;
    END IF;

    NEW.pipeline_id := v_closer_pipeline_id;
    NEW.stage_id := v_target_stage_id;

    -- Preserve George as SDR
    IF NEW.sdr_user_id IS NULL THEN
      NEW.sdr_user_id := v_george_id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_enforce_sdr_pipeline_routing ON public.deals;

-- Create trigger BEFORE insert or update
CREATE TRIGGER trg_enforce_sdr_pipeline_routing
  BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sdr_pipeline_routing();
