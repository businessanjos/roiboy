DELETE FROM public.threecplus_call_logs p
USING public.threecplus_call_logs s
WHERE (p.call_id IS NULL OR p.call_id = '')
  AND COALESCE(p.metadata->>'source','click2call_api') = 'click2call_api'
  AND s.call_id IS NOT NULL AND s.call_id <> ''
  AND s.account_id = p.account_id
  AND s.direction = p.direction
  AND right(regexp_replace(COALESCE(s.phone,''), '\D', '', 'g'), 8)
      = right(regexp_replace(COALESCE(p.phone,''), '\D', '', 'g'), 8)
  AND length(regexp_replace(COALESCE(p.phone,''), '\D', '', 'g')) >= 8
  AND (s.user_id IS NULL OR p.user_id IS NULL OR s.user_id = p.user_id)
  AND abs(EXTRACT(EPOCH FROM (s.started_at - p.started_at))) <= 180;

UPDATE public.threecplus_call_logs
SET status = 'dialing', connected_at = NULL
WHERE (call_id IS NULL OR call_id = '')
  AND COALESCE(metadata->>'source','click2call_api') = 'click2call_api'
  AND status = 'connected'
  AND COALESCE(duration_seconds,0) = 0;