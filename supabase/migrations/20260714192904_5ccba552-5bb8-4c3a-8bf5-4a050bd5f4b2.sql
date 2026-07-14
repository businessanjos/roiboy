UPDATE public.zapp_conversation_assignments AS a
SET
  department_id = d.id,
  agent_id = NULL,
  assigned_at = NULL,
  closed_at = NULL,
  closed_by = NULL,
  status = 'pending',
  updated_at = NOW()
FROM public.zapp_departments AS d
WHERE a.zapp_conversation_id = 'ed2e0c7f-cbea-4baa-829e-ea48e5cf4206'
  AND d.account_id = a.account_id
  AND d.sector_id = 'operacoes';