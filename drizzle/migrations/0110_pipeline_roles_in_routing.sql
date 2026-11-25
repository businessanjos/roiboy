CREATE OR REPLACE FUNCTION public.ensure_deal_pipeline_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.pipeline_id IS NULL AND NEW.stage_id IS NOT NULL THEN
    SELECT pipeline_id INTO NEW.pipeline_id FROM public.deal_stages WHERE id = NEW.stage_id;
  END IF;
  -- Funil padrão pelo papel fixo; os nomes conhecidos ficam só como reserva.
  IF NEW.pipeline_id IS NULL THEN
    SELECT id INTO NEW.pipeline_id
    FROM public.pipelines
    WHERE account_id = NEW.account_id AND is_active = true
    ORDER BY CASE WHEN system_role = 'closer' THEN 0
                  WHEN name ILIKE '%closer%' OR name ILIKE '%mentoria%' THEN 1
                  ELSE 2 END, display_order
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$fn$;

DO $do$
DECLARE def text; step1 text; step2 text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'bulk_deal_item_apply';
  step1 := replace(def,
    $s$IF s.name='Reunião Agendada' AND source_pipeline='SDR' THEN$s$,
    $s$IF s.name='Reunião Agendada' AND (source_pipeline='SDR' OR EXISTS (SELECT 1 FROM pipelines sp WHERE sp.id=d.pipeline_id AND sp.system_role='sdr')) THEN$s$);
  IF step1 = def THEN RAISE EXCEPTION 'bulk_deal_item_apply: origem SDR não encontrada'; END IF;
  step2 := replace(step1,
    $s$p.name IN ('Closer','Funil Mentoria') AND p.is_active AND ds.name='Reunião Agendada' AND ds.is_active ORDER BY p.created_at LIMIT 1$s$,
    $s$(p.system_role='closer' OR p.name IN ('Closer','Funil Mentoria')) AND p.is_active AND ds.name='Reunião Agendada' AND ds.is_active ORDER BY (p.system_role IS NOT DISTINCT FROM 'closer') DESC, p.created_at LIMIT 1$s$);
  IF step2 = step1 THEN RAISE EXCEPTION 'bulk_deal_item_apply: destino de fechamento não encontrado'; END IF;
  step2 := replace(step2, 'Etapa Reunião Agendada no Funil Mentoria indisponível.', 'Etapa Reunião Agendada no funil de fechamento indisponível.');
  EXECUTE step2;
END
$do$;