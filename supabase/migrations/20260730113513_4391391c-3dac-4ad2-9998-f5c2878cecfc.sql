CREATE OR REPLACE FUNCTION public.repair_zapp_conversation_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  thread_digits text;
  current_digits text;
  candidate text;
BEGIN
  IF COALESCE(NEW.is_group, false) THEN
    RETURN NEW;
  END IF;

  current_digits := regexp_replace(COALESCE(NEW.phone_e164, ''), '\D', '', 'g');
  IF length(current_digits) >= 10 THEN
    RETURN NEW;
  END IF;

  IF NEW.external_thread_id IS NULL OR NEW.external_thread_id ILIKE '%@lid%' THEN
    RETURN NEW;
  END IF;

  thread_digits := regexp_replace(split_part(split_part(NEW.external_thread_id, '@', 1), ':', 1), '\D', '', 'g');
  IF length(thread_digits) NOT BETWEEN 10 AND 15 THEN
    RETURN NEW;
  END IF;

  candidate := '+' || thread_digits;

  IF EXISTS (
    SELECT 1 FROM public.zapp_conversations z
    WHERE z.account_id = NEW.account_id
      AND z.phone_e164 = candidate
      AND z.integration_id IS NOT DISTINCT FROM NEW.integration_id
      AND z.id IS DISTINCT FROM NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  NEW.phone_e164 := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_repair_zapp_conversation_phone ON public.zapp_conversations;
CREATE TRIGGER trg_repair_zapp_conversation_phone
BEFORE INSERT OR UPDATE OF phone_e164, external_thread_id ON public.zapp_conversations
FOR EACH ROW EXECUTE FUNCTION public.repair_zapp_conversation_phone();

WITH candidates AS (
  SELECT c.id,
         c.account_id,
         c.integration_id,
         '+' || regexp_replace(split_part(split_part(c.external_thread_id, '@', 1), ':', 1), '\D', '', 'g') AS candidate
  FROM public.zapp_conversations c
  WHERE COALESCE(c.is_group, false) = false
    AND length(regexp_replace(COALESCE(c.phone_e164, ''), '\D', '', 'g')) < 10
    AND c.external_thread_id IS NOT NULL
    AND c.external_thread_id NOT ILIKE '%@lid%'
    AND length(regexp_replace(split_part(split_part(c.external_thread_id, '@', 1), ':', 1), '\D', '', 'g')) BETWEEN 10 AND 15
),
dedup AS (
  SELECT DISTINCT ON (account_id, integration_id, candidate) id, account_id, integration_id, candidate
  FROM candidates
  ORDER BY account_id, integration_id, candidate, id
)
UPDATE public.zapp_conversations c
SET phone_e164 = d.candidate
FROM dedup d
WHERE c.id = d.id
  AND NOT EXISTS (
    SELECT 1 FROM public.zapp_conversations z
    WHERE z.account_id = d.account_id
      AND z.phone_e164 = d.candidate
      AND z.integration_id IS NOT DISTINCT FROM d.integration_id
      AND z.id <> d.id
  );