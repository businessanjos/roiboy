ALTER TABLE public.zapp_conversation_assignments
  DROP CONSTRAINT IF EXISTS zapp_conversation_assignments_conversation_id_key;
DROP INDEX IF EXISTS public.zapp_conversation_assignments_zapp_conv_uniq;

INSERT INTO public.zapp_conversation_assignments (account_id, zapp_conversation_id, department_id, status)
SELECT zc.account_id, zc.id, d.id, 'pending'
FROM public.zapp_conversations zc
JOIN public.zapp_departments d
  ON d.account_id = zc.account_id AND d.sector_id = zc.sector_id
WHERE zc.is_group = true
  AND zc.sector_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.zapp_conversation_assignments a
    WHERE a.zapp_conversation_id = zc.id AND a.department_id = d.id
  )
ON CONFLICT DO NOTHING;