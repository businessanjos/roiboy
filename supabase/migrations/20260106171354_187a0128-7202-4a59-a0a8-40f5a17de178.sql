-- Add unique constraint to prevent duplicate assignments for same conversation + department
CREATE UNIQUE INDEX IF NOT EXISTS idx_zapp_conversation_assignments_unique 
ON zapp_conversation_assignments (account_id, zapp_conversation_id, department_id)
WHERE department_id IS NOT NULL;

-- Also add constraint for null department_id cases
CREATE UNIQUE INDEX IF NOT EXISTS idx_zapp_conversation_assignments_unique_no_dept
ON zapp_conversation_assignments (account_id, zapp_conversation_id)
WHERE department_id IS NULL;