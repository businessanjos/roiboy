UPDATE public.practice_areas SET label = btrim(label) WHERE label <> btrim(label);

CREATE UNIQUE INDEX IF NOT EXISTS practice_areas_label_unique_ci
  ON public.practice_areas (lower(btrim(label)));

REVOKE ALL ON public.practice_areas FROM anon;
REVOKE ALL ON public.practice_areas FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_areas TO authenticated;
GRANT ALL ON public.practice_areas TO service_role;