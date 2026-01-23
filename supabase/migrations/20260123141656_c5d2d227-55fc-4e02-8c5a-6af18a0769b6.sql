-- Remover constraint antiga
ALTER TABLE public.client_followups DROP CONSTRAINT IF EXISTS client_followups_type_check;

-- Criar constraint atualizada incluindo 'financial_note'
ALTER TABLE public.client_followups ADD CONSTRAINT client_followups_type_check 
CHECK (type = ANY (ARRAY['note', 'file', 'image', 'financial_note']));