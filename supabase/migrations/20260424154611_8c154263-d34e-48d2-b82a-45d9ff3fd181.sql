-- Backend normalization for deal_stages.name (mirrors frontend normalizeStageName).
-- Order matters: unaccent_immutable must exist before normalize_stage_name references it.

CREATE OR REPLACE FUNCTION public.unaccent_immutable(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT translate(
    p_text,
    'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñÝýÿ',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy'
  );
$$;

CREATE OR REPLACE FUNCTION public.normalize_stage_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_name IS NULL THEN ''
    ELSE btrim(
      regexp_replace(
        lower(public.unaccent_immutable(p_name)),
        '[^a-z0-9]+',
        ' ',
        'g'
      )
    )
  END
$$;

ALTER TABLE public.deal_stages
  ADD COLUMN IF NOT EXISTS name_normalized text;

UPDATE public.deal_stages
   SET name_normalized = public.normalize_stage_name(name)
 WHERE name_normalized IS DISTINCT FROM public.normalize_stage_name(name);

CREATE OR REPLACE FUNCTION public.deal_stages_set_name_normalized()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.name_normalized := public.normalize_stage_name(NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_stages_set_name_normalized ON public.deal_stages;
CREATE TRIGGER trg_deal_stages_set_name_normalized
BEFORE INSERT OR UPDATE OF name ON public.deal_stages
FOR EACH ROW
EXECUTE FUNCTION public.deal_stages_set_name_normalized();

CREATE INDEX IF NOT EXISTS idx_deal_stages_account_normalized
  ON public.deal_stages(account_id, name_normalized);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_deal_stages_pipeline_name_normalized_active
  ON public.deal_stages(pipeline_id, name_normalized)
  WHERE is_active = true AND pipeline_id IS NOT NULL;
