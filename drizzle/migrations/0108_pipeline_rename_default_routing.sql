CREATE OR REPLACE FUNCTION public.ensure_deal_pipeline_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.pipeline_id IS NULL AND NEW.stage_id IS NOT NULL THEN
    SELECT pipeline_id INTO NEW.pipeline_id FROM public.deal_stages WHERE id = NEW.stage_id;
  END IF;
  -- Funil padrão: "Closer" foi renomeado para "Funil Mentoria"; aceita ambos.
  IF NEW.pipeline_id IS NULL THEN
    SELECT id INTO NEW.pipeline_id
    FROM public.pipelines
    WHERE account_id = NEW.account_id AND is_active = true
    ORDER BY CASE WHEN name ILIKE '%closer%' OR name ILIKE '%mentoria%' THEN 0 ELSE 1 END, display_order
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$fn$;

DO $do$
DECLARE def text; newdef text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='bulk_deal_item_apply';
  newdef := replace(def, $s$p.name='Closer' AND p.is_active AND ds.name='Reunião Agendada' AND ds.is_active LIMIT 1$s$,
                         $s$p.name IN ('Closer','Funil Mentoria') AND p.is_active AND ds.name='Reunião Agendada' AND ds.is_active ORDER BY p.created_at LIMIT 1$s$);
  newdef := replace(newdef, 'Etapa Reunião Agendada no Closer indisponível.', 'Etapa Reunião Agendada no Funil Mentoria indisponível.');
  IF newdef = def THEN RAISE EXCEPTION 'bulk_deal_item_apply: trecho esperado não encontrado'; END IF;
  EXECUTE newdef;
END
$do$;