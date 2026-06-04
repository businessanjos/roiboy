
-- Auto-attribution of campaigns to agencies via name prefix rules

ALTER TABLE public.traffic_agencies
  ADD COLUMN IF NOT EXISTS name_patterns text[] NOT NULL DEFAULT '{}';

-- Seed known agencies' patterns (overwrites existing patterns for these two)
UPDATE public.traffic_agencies SET name_patterns = ARRAY['SN -']
  WHERE name = 'Social Nudge';
UPDATE public.traffic_agencies SET name_patterns = ARRAY['[AMO]', 'Anjos-', 'Eternum-']
  WHERE name = 'Impulse';

-- Apply rules across an account (prefix, case-insensitive)
CREATE OR REPLACE FUNCTION public.apply_agency_rules(p_account_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  WITH matches AS (
    SELECT DISTINCT ON (ms.id) ms.id AS ad_set_id, a.id AS agency_id
    FROM public.marketing_ad_sets ms
    JOIN public.traffic_agencies a
      ON a.account_id = p_account_id
     AND a.is_active
     AND EXISTS (
       SELECT 1
       FROM unnest(a.name_patterns) AS p
       WHERE p <> '' AND ms.name ILIKE p || '%'
     )
    WHERE ms.account_id = p_account_id
    ORDER BY ms.id, length(array_to_string(a.name_patterns, '')) DESC, a.created_at ASC
  ),
  upd AS (
    UPDATE public.marketing_ad_sets ms
    SET agency_id = m.agency_id, updated_at = now()
    FROM matches m
    WHERE ms.id = m.ad_set_id
      AND (ms.agency_id IS DISTINCT FROM m.agency_id)
    RETURNING 1
  )
  SELECT count(*) INTO v_updated FROM upd;
  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_agency_rules(uuid) TO authenticated;

-- Trigger to auto-tag new/updated ad sets when agency_id is NULL
CREATE OR REPLACE FUNCTION public.tg_auto_tag_ad_set_agency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id uuid;
BEGIN
  IF NEW.agency_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.account_id IS NULL OR NEW.name IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.id INTO v_agency_id
  FROM public.traffic_agencies a
  WHERE a.account_id = NEW.account_id
    AND a.is_active
    AND EXISTS (
      SELECT 1 FROM unnest(a.name_patterns) p
      WHERE p <> '' AND NEW.name ILIKE p || '%'
    )
  ORDER BY length(array_to_string(a.name_patterns, '')) DESC, a.created_at ASC
  LIMIT 1;

  IF v_agency_id IS NOT NULL THEN
    NEW.agency_id := v_agency_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_tag_ad_set_agency ON public.marketing_ad_sets;
CREATE TRIGGER auto_tag_ad_set_agency
  BEFORE INSERT OR UPDATE OF name, account_id ON public.marketing_ad_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_auto_tag_ad_set_agency();

-- Backfill existing rows now
SELECT public.apply_agency_rules(account_id)
FROM (SELECT DISTINCT account_id FROM public.traffic_agencies WHERE account_id IS NOT NULL) s;
