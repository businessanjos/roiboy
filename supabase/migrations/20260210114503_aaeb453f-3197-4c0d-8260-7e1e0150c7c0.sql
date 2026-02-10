-- Fix inconsistent assignments: status != closed but closed_at is set and agent_id still present
-- These are ghost conversations that were closed but reopened by race condition
UPDATE public.zapp_conversation_assignments
SET 
  status = 'closed',
  agent_id = NULL,
  assigned_at = NULL,
  updated_at = now()
WHERE 
  status != 'closed'
  AND closed_at IS NOT NULL
  AND agent_id IS NOT NULL
  AND updated_at < now() - interval '1 minute';