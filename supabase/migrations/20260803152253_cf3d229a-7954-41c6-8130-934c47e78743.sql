UPDATE public.zapp_conversation_assignments
SET status = 'closed', closed_at = now(), updated_at = now()
WHERE id = '1043df9b-69c7-4e1e-8470-c9c2a85f8990';