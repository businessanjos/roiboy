DO $migration$
DECLARE definition text; updated text;
BEGIN
  SELECT pg_get_functiondef('public.bulk_deal_item_apply()'::regprocedure) INTO definition;
  updated := replace(definition,
    $old$IF d.status<>'open' THEN RAISE EXCEPTION 'Negócio encerrado. Reabra individualmente antes de mudar o funil ou a etapa.'; END IF;$old$,
    $new$-- Moving a deal never reopens it or changes its outcome.$new$);
  IF updated = definition THEN RAISE EXCEPTION 'bulk_deal_item_apply: closed-deal guard not found'; END IF;
  definition := updated;
  updated := replace(definition,
    'probability=coalesce(s.probability,0) WHERE id=d.id',
    'probability=CASE WHEN d.status=''open'' THEN coalesce(s.probability,0) ELSE d.probability END WHERE id=d.id');
  IF updated = definition THEN RAISE EXCEPTION 'bulk_deal_item_apply: probability assignment not found'; END IF;
  EXECUTE updated;

  SELECT pg_get_functiondef('public.undo_last_bulk_deal_move(uuid)'::regprocedure) INTO definition;
  updated := replace(definition,
    $old$d.status<>'open'$old$,
    $new$d.status::text IS DISTINCT FROM (i.after_state->'deal'->>'status')$new$);
  IF updated = definition THEN RAISE EXCEPTION 'undo_last_bulk_deal_move: status guard not found'; END IF;
  EXECUTE updated;

  SELECT pg_get_functiondef('public.bulk_deal_capture_undo()'::regprocedure) INTO definition;
  updated := replace(definition,
    'IF OLD.pipeline_id IS DISTINCT FROM',
    $new$IF OLD.status::text IS DISTINCT FROM (i.after_state->'deal'->>'status') OR NEW.status IS DISTINCT FROM OLD.status OR OLD.pipeline_id IS DISTINCT FROM$new$);
  IF updated = definition THEN RAISE EXCEPTION 'bulk_deal_capture_undo: snapshot guard not found'; END IF;
  EXECUTE updated;
END
$migration$;