-- 1) Dedupe: keep highest-priority row per zapp_conversation_id
WITH ranked AS (
  SELECT id,
         zapp_conversation_id,
         ROW_NUMBER() OVER (
           PARTITION BY zapp_conversation_id
           ORDER BY
             CASE status::text
               WHEN 'active'  THEN 1
               WHEN 'waiting' THEN 2
               WHEN 'pending' THEN 3
               WHEN 'triage'  THEN 4
               WHEN 'open'    THEN 5
               WHEN 'closed'  THEN 6
               ELSE 7
             END,
             COALESCE(updated_at, created_at) DESC NULLS LAST
         ) AS rn
  FROM public.zapp_conversation_assignments
  WHERE zapp_conversation_id IS NOT NULL
)
DELETE FROM public.zapp_conversation_assignments a
USING ranked r
WHERE a.id = r.id AND r.rn > 1;

-- 2) Prevent duplicates going forward (partial unique index ignores NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS zapp_conversation_assignments_zapp_conv_uniq
  ON public.zapp_conversation_assignments (zapp_conversation_id)
  WHERE zapp_conversation_id IS NOT NULL;