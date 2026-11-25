ALTER TABLE public.pipelines
  ADD COLUMN IF NOT EXISTS system_role text,
  ADD COLUMN IF NOT EXISTS previous_names text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.pipelines.system_role IS 'Papel fixo do funil (sdr, closer, low_ticket). As regras usam este papel, nunca o nome.';
COMMENT ON COLUMN public.pipelines.previous_names IS 'Nomes anteriores do funil, mantidos pelo gatilho de troca de nome.';

-- Backfill do papel a partir dos nomes conhecidos (um funil ativo por papel e conta).
UPDATE public.pipelines p SET system_role = r.role
FROM (
  SELECT DISTINCT ON (account_id, role) id, role FROM (
    SELECT id, account_id, created_at,
      CASE WHEN lower(btrim(name)) = 'sdr' THEN 'sdr'
           WHEN lower(btrim(name)) IN ('closer', 'funil mentoria') THEN 'closer'
           WHEN lower(btrim(name)) IN ('tp - eternum pass', 'e-pass / clinica ryka', 'e-pass') THEN 'low_ticket'
      END AS role
    FROM public.pipelines WHERE is_active
  ) x WHERE role IS NOT NULL
  ORDER BY account_id, role, created_at
) r
WHERE p.id = r.id AND p.system_role IS NULL;

-- Backfill dos nomes anteriores já conhecidos.
UPDATE public.pipelines SET previous_names = ARRAY['Closer']
 WHERE lower(btrim(name)) = 'funil mentoria' AND previous_names = '{}';
UPDATE public.pipelines SET previous_names = ARRAY['TP - Eternum Pass', 'E-Pass / Clinica Ryka']
 WHERE lower(btrim(name)) = 'e-pass' AND previous_names = '{}';
UPDATE public.pipelines SET previous_names = ARRAY['Repescagem / Cadencia']
 WHERE lower(btrim(name)) = 'funil de repescagem' AND previous_names = '{}';

ALTER TABLE public.pipelines
  ADD CONSTRAINT pipelines_system_role_check
  CHECK (system_role IS NULL OR system_role IN ('sdr', 'closer', 'low_ticket'));

CREATE UNIQUE INDEX IF NOT EXISTS pipelines_account_system_role_uniq
  ON public.pipelines (account_id, system_role)
  WHERE system_role IS NOT NULL AND is_active;

CREATE TABLE public.pipeline_name_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  old_name text NOT NULL,
  new_name text NOT NULL,
  changed_by uuid,
  visuals_updated integer NOT NULL DEFAULT 0,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pipeline_name_history TO authenticated;
GRANT ALL ON public.pipeline_name_history TO service_role;
ALTER TABLE public.pipeline_name_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account members can view pipeline name history"
  ON public.pipeline_name_history FOR SELECT TO authenticated
  USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));
CREATE INDEX pipeline_name_history_pipeline_idx
  ON public.pipeline_name_history (pipeline_id, changed_at DESC);

-- Um gráfico salvo filtra por este nome de funil?
CREATE OR REPLACE FUNCTION public.insights_config_uses_pipeline_name(p_config jsonb, p_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $fn$
  SELECT jsonb_typeof(p_config->'filters') = 'array' AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_config->'filters') f,
         jsonb_array_elements(CASE WHEN jsonb_typeof(f->'values') = 'array' THEN f->'values' ELSE '[]'::jsonb END) e
    WHERE f->>'field' = 'pipeline_name'
      AND COALESCE(f->>'source', 'native') = 'native'
      AND jsonb_typeof(e) = 'string'
      AND lower(e#>>'{}') = lower(p_name)
  );
$fn$;

-- Papel e nomes anteriores são mantidos pelo servidor; a tela só muda nome, descrição, cor e ordem.
CREATE OR REPLACE FUNCTION public.pipelines_guard_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.system_role := NULL;
      NEW.previous_names := '{}';
    END IF;
    RETURN NEW;
  END IF;
  IF auth.uid() IS NOT NULL AND pg_trigger_depth() = 1 THEN
    NEW.system_role := OLD.system_role;
    NEW.previous_names := OLD.previous_names;
  END IF;
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    NEW.previous_names := COALESCE((
      SELECT array_agg(s.n ORDER BY s.o) FROM (
        SELECT DISTINCT ON (lower(t.n)) t.n, t.o
        FROM unnest(OLD.previous_names || OLD.name) WITH ORDINALITY t(n, o)
        WHERE lower(t.n) <> lower(NEW.name)
        ORDER BY lower(t.n), t.o
      ) s), '{}');
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER pipelines_guard_identity
  BEFORE INSERT OR UPDATE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.pipelines_guard_identity();

-- Troca de nome: o nome atual vence apelidos de outros funis, os gráficos salvos acompanham e fica o registro.
CREATE OR REPLACE FUNCTION public.pipelines_after_rename()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_count integer := 0;
  v_user uuid;
BEGIN
  IF NEW.name IS NOT DISTINCT FROM OLD.name THEN RETURN NULL; END IF;

  UPDATE public.pipelines p
     SET previous_names = ARRAY(SELECT n FROM unnest(p.previous_names) n WHERE lower(n) <> lower(NEW.name))
   WHERE p.account_id = NEW.account_id AND p.id <> NEW.id
     AND EXISTS (SELECT 1 FROM unnest(p.previous_names) n WHERE lower(n) = lower(NEW.name));

  -- Só acompanha quando o nome antigo apontava para um único funil da conta.
  IF NOT EXISTS (
    SELECT 1 FROM public.pipelines o
    WHERE o.account_id = NEW.account_id AND o.id <> NEW.id AND lower(o.name) = lower(OLD.name)
  ) THEN
    UPDATE public.insights_visuals v
       SET config = jsonb_set(v.config, '{filters}', (
         SELECT jsonb_agg(
           CASE WHEN y.f->>'field' = 'pipeline_name'
                 AND COALESCE(y.f->>'source', 'native') = 'native'
                 AND jsonb_typeof(y.f->'values') = 'array'
             THEN jsonb_set(y.f, '{values}', COALESCE((
               SELECT jsonb_agg(
                 CASE WHEN jsonb_typeof(x.e) = 'string' AND lower(x.e#>>'{}') = lower(OLD.name)
                   THEN to_jsonb(NEW.name) ELSE x.e END ORDER BY x.i)
               FROM jsonb_array_elements(y.f->'values') WITH ORDINALITY x(e, i)), '[]'::jsonb))
             ELSE y.f END ORDER BY y.o)
         FROM jsonb_array_elements(v.config->'filters') WITH ORDINALITY y(f, o)))
      FROM public.insights_dashboards d
     WHERE d.id = v.dashboard_id
       AND d.account_id = NEW.account_id
       AND public.insights_config_uses_pipeline_name(v.config, OLD.name);
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  SELECT u.id INTO v_user FROM public.users u
   WHERE u.auth_user_id = auth.uid() AND u.account_id = NEW.account_id LIMIT 1;

  INSERT INTO public.pipeline_name_history (account_id, pipeline_id, old_name, new_name, changed_by, visuals_updated)
  VALUES (NEW.account_id, NEW.id, OLD.name, NEW.name, v_user, v_count);
  RETURN NULL;
END;
$fn$;

CREATE TRIGGER pipelines_after_rename
  AFTER UPDATE OF name ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.pipelines_after_rename();

-- O que a troca de nome alcança, para avisar antes de salvar (só quantidades).
CREATE OR REPLACE FUNCTION public.pipeline_rename_impact(p_pipeline_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_account uuid; v_name text; v_role text; v_previous text[];
  v_charts integer; v_dashboards integer;
BEGIN
  SELECT p.account_id, p.name, p.system_role, p.previous_names
    INTO v_account, v_name, v_role, v_previous
    FROM public.pipelines p WHERE p.id = p_pipeline_id;
  IF v_account IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.account_id = v_account
  ) THEN
    RAISE EXCEPTION 'Funil não encontrado.';
  END IF;
  SELECT count(*), count(DISTINCT v.dashboard_id) INTO v_charts, v_dashboards
    FROM public.insights_visuals v
    JOIN public.insights_dashboards d ON d.id = v.dashboard_id
   WHERE d.account_id = v_account
     AND public.insights_config_uses_pipeline_name(v.config, v_name);
  RETURN jsonb_build_object(
    'charts', v_charts, 'dashboards', v_dashboards,
    'system_role', v_role, 'previous_names', to_jsonb(v_previous));
END;
$fn$;

REVOKE ALL ON FUNCTION public.pipeline_rename_impact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pipeline_rename_impact(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.pipelines_after_rename() FROM PUBLIC, anon, authenticated;