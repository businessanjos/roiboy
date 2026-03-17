
-- Move George's deals from Closer to SDR (same stage names)
-- Chegou Lead: Closer 67c266c3 → SDR a709e981
UPDATE public.deals 
SET pipeline_id = 'f2de0548-1d92-4617-8397-3962c7adbaa5',
    stage_id = 'a709e981-5b77-402f-bec0-857ff4b17eba',
    updated_at = now()
WHERE pipeline_id = '4a96159e-c6a2-432f-8128-9ac345e58c18'
  AND responsible_user_id = 'cefc44c7-d2e2-4937-94ac-069c1c94731b'
  AND stage_id = '67c266c3-5bc0-400c-ada2-054ff9e62aa2';

-- Contato Realizado: Closer c21a5648 → SDR 1020a877
UPDATE public.deals 
SET pipeline_id = 'f2de0548-1d92-4617-8397-3962c7adbaa5',
    stage_id = '1020a877-d237-43d6-8fdb-34cff157def3',
    updated_at = now()
WHERE pipeline_id = '4a96159e-c6a2-432f-8128-9ac345e58c18'
  AND responsible_user_id = 'cefc44c7-d2e2-4937-94ac-069c1c94731b'
  AND stage_id = 'c21a5648-ba29-47ec-85fd-1caf36df38fc';

-- Em Qualificação: Closer f4da9f85 → SDR 720d239b
UPDATE public.deals 
SET pipeline_id = 'f2de0548-1d92-4617-8397-3962c7adbaa5',
    stage_id = '720d239b-4a7f-4b31-97bf-14d158bdbc60',
    updated_at = now()
WHERE pipeline_id = '4a96159e-c6a2-432f-8128-9ac345e58c18'
  AND responsible_user_id = 'cefc44c7-d2e2-4937-94ac-069c1c94731b'
  AND stage_id = 'f4da9f85-e1c1-4f9a-aec0-149bf88f725e';
