CREATE INDEX IF NOT EXISTS idx_zapp_assign_acct_dept_updated
  ON public.zapp_conversation_assignments (account_id, department_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_tasks_assigned_created
  ON public.internal_tasks (assigned_to, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_tasks_acttype_assigned_created
  ON public.internal_tasks (activity_type_id, assigned_to, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_zapp_messages_external_trgm
  ON public.zapp_messages USING gin (external_message_id gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_zapp_messages_sentat_conv
  ON public.zapp_messages (sent_at DESC, zapp_conversation_id);

ANALYZE public.zapp_conversation_assignments;
ANALYZE public.internal_tasks;
ANALYZE public.zapp_messages;