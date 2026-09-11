UPDATE public.threecplus_call_logs
SET status = 'failed',
    ended_at = COALESCE(ended_at, now()),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'threec_error', 'Tentativa não confirmada pela 3C',
      'cleanup_reason', 'orphan_placeholder_over_15m',
      'cleaned_at', now()
    )
WHERE call_id IS NULL
  AND status = 'dialing'
  AND started_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'
  AND started_at < now() - interval '15 minutes';