-- Remove qualquer agendamento antigo com o mesmo nome (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-instagram-highlights-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-instagram-highlights-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Agenda recálculo diário às 04:00 UTC (~01:00 BRT)
SELECT cron.schedule(
  'refresh-instagram-highlights-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mtzoavtbtqflufyccern.supabase.co/functions/v1/refresh-instagram-highlights',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10em9hdnRidHFmbHVmeWNjZXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDQ2MDYsImV4cCI6MjA4MTQyMDYwNn0.aFVdVFXwpE7iU7G_u-Ehh-FBFxH32fHiZVo8-RzRGUA"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  ) as request_id;
  $$
);