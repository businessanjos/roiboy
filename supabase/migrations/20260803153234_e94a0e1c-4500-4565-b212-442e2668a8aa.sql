WITH stats AS (
  SELECT m.zapp_conversation_id AS cid,
         COUNT(*) FILTER (WHERE m.external_message_id LIKE '554388346806:%') AS via_cs,
         COUNT(*) FILTER (WHERE m.external_message_id LIKE '554388382681:%') AS via_com
  FROM public.zapp_messages m
  GROUP BY m.zapp_conversation_id
),
targets AS (
  SELECT c.id, c.account_id, c.phone_e164
  FROM public.zapp_conversations c
  JOIN stats s ON s.cid = c.id
  WHERE c.integration_id = 'c3baa312-78b9-400f-802a-705d56731f90'
    AND s.via_cs > 0
    AND s.via_com = 0
),
movable AS (
  SELECT t.id FROM targets t
  WHERE NOT EXISTS (
    SELECT 1 FROM public.zapp_conversations x
    WHERE x.account_id = t.account_id
      AND x.phone_e164 = t.phone_e164
      AND x.integration_id = '65cbf5f6-3479-49d0-9465-3d53d4a76ff9'
  )
),
moved AS (
  UPDATE public.zapp_conversations c
  SET integration_id = '65cbf5f6-3479-49d0-9465-3d53d4a76ff9',
      sector_id = 'operacoes',
      updated_at = now()
  FROM movable mv
  WHERE c.id = mv.id
  RETURNING c.id
)
UPDATE public.zapp_conversation_assignments a
SET status = 'closed', closed_at = now(), updated_at = now()
WHERE a.status <> 'closed'
  AND a.zapp_conversation_id IN (SELECT id FROM targets)
  AND a.zapp_conversation_id NOT IN (SELECT id FROM movable);