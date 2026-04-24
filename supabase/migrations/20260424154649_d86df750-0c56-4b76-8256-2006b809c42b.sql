CREATE OR REPLACE FUNCTION public.unaccent_immutable(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
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
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.deal_stages_set_name_normalized()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.name_normalized := public.normalize_stage_name(NEW.name);
  RETURN NEW;
END;
$$;
