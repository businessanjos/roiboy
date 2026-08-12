DO $$
DECLARE jid BIGINT;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'briefing-missing-alert-daily';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'briefing-missing-alert-daily',
  '0 13 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://mtzoavtbtqflufyccern.supabase.co/functions/v1/briefing-missing-alert',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10em9hdnRidHFmbHVmeWNjZXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDQ2MDYsImV4cCI6MjA4MTQyMDYwNn0.aFVdVFXwpE7iU7G_u-Ehh-FBFxH32fHiZVo8-RzRGUA"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);