-- Remover constraint antigo
ALTER TABLE deal_activities DROP CONSTRAINT IF EXISTS deal_activities_type_check;

-- Adicionar constraint atualizado com novos tipos
ALTER TABLE deal_activities ADD CONSTRAINT deal_activities_type_check 
CHECK (type = ANY (ARRAY['note'::text, 'call'::text, 'email'::text, 'meeting'::text, 'task'::text, 'stage_change'::text, 'status_change'::text, 'image'::text, 'file'::text]));