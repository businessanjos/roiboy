CREATE OR REPLACE FUNCTION public.traffic_hub_enqueue_backfill(_account_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inserted integer := 0;
BEGIN
  WITH opts AS (
    SELECT jsonb_array_elements(cf.options) o
    FROM public.custom_fields cf
    WHERE cf.name = 'Origem da Venda' AND cf.show_in_deals = true
  ), tv AS (
    SELECT DISTINCT o->>'value' AS v FROM opts
    WHERE upper(o->>'label') LIKE '%TRAF-STUDIO-EC%'
       OR upper(o->>'label') LIKE '%TRAF-IMP-EC%'
  ), td AS (
    SELECT DISTINCT dfv.deal_id
    FROM public.deal_field_values dfv
    WHERE EXISTS (
      SELECT 1 FROM tv WHERE tv.v = ANY(
        CASE WHEN jsonb_typeof(dfv.value_json) = 'array'
          THEN (SELECT array_agg(x #>> '{}') FROM jsonb_array_elements(dfv.value_json) x)
          ELSE ARRAY[dfv.value_text] END)
    )
  ), src AS (
    SELECT d.account_id,
           d.id AS deal_id,
           CASE WHEN d.status = 'won' THEN 'sale'
                WHEN d.status = 'lost' THEN 'lost'
                ELSE 'stage' END AS event_type,
           CASE WHEN d.status = 'open' THEN d.stage_id ELSE NULL END AS stage_id
    FROM public.deals d
    JOIN td ON td.deal_id = d.id
    WHERE d.deleted_at IS NULL
      AND d.account_id = _account_id
      AND d.status IN ('won', 'lost', 'open')
  ), ins AS (
    INSERT INTO public.traffic_hub_deliveries
      (account_id, deal_id, event_type, stage_id, status, attempts, next_attempt_at)
    SELECT account_id, deal_id, event_type, stage_id, 'pending', 0, now() FROM src
    ON CONFLICT (deal_id, event_type, stage_id) DO UPDATE
      SET status = 'pending', attempts = 0, next_attempt_at = now(), last_error = NULL
      WHERE public.traffic_hub_deliveries.status <> 'sent'
    RETURNING 1
  )
  SELECT count(*) INTO _inserted FROM ins;

  RETURN _inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.traffic_hub_enqueue_backfill(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.traffic_hub_enqueue_backfill(uuid) TO service_role;