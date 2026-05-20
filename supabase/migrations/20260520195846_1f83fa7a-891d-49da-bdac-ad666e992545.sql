-- Step 1: identify keepers and duplicates
CREATE TEMP TABLE _group_dupes ON COMMIT DROP AS
WITH ranked AS (
  SELECT id, account_id, sector_id, group_jid, created_at,
    ROW_NUMBER() OVER (PARTITION BY account_id, sector_id, group_jid ORDER BY created_at ASC, id ASC) AS rn,
    FIRST_VALUE(id) OVER (PARTITION BY account_id, sector_id, group_jid ORDER BY created_at ASC, id ASC) AS keeper_id
  FROM public.zapp_conversations
  WHERE is_group = true AND group_jid IS NOT NULL AND sector_id IS NOT NULL
)
SELECT id AS dupe_id, keeper_id FROM ranked WHERE rn > 1;

-- Step 2: delete messages from dupes that would collide with keepers (exact external_message_id)
DELETE FROM public.zapp_messages m
USING _group_dupes d
WHERE m.zapp_conversation_id = d.dupe_id
  AND m.external_message_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.zapp_messages k
    WHERE k.zapp_conversation_id = d.keeper_id
      AND k.external_message_id = m.external_message_id
  );

-- Step 3: also dedupe by suffix (multi-instance same WA message)
DELETE FROM public.zapp_messages m
USING _group_dupes d
WHERE m.zapp_conversation_id = d.dupe_id
  AND m.external_message_id LIKE '%:%'
  AND EXISTS (
    SELECT 1 FROM public.zapp_messages k
    WHERE k.zapp_conversation_id = d.keeper_id
      AND k.external_message_id LIKE '%:%'
      AND split_part(k.external_message_id, ':', 2) = split_part(m.external_message_id, ':', 2)
      AND k.direction = m.direction
  );

-- Step 4: move remaining messages to keeper
UPDATE public.zapp_messages m
SET zapp_conversation_id = d.keeper_id
FROM _group_dupes d
WHERE m.zapp_conversation_id = d.dupe_id;

-- Step 5: delete duplicate conversations
DELETE FROM public.zapp_conversations WHERE id IN (SELECT dupe_id FROM _group_dupes);

-- Step 6: final cleanup inside keeper conversations (suffix dedup)
WITH expanded AS (
  SELECT id, zapp_conversation_id, direction, created_at, external_message_id,
    ROW_NUMBER() OVER (
      PARTITION BY zapp_conversation_id, direction,
        CASE WHEN external_message_id LIKE '%:%' THEN split_part(external_message_id, ':', 2) ELSE external_message_id END
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.zapp_messages
  WHERE external_message_id IS NOT NULL
)
DELETE FROM public.zapp_messages
WHERE id IN (SELECT id FROM expanded WHERE rn > 1);