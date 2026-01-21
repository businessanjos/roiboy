-- Limpar client_id e lead_id de conversas de grupo (vinculação incorreta que causa bug de nome)
-- Grupos não devem ter cliente/lead vinculado pois isso sobrescreve o nome do grupo na UI

UPDATE public.zapp_conversations
SET client_id = NULL, lead_id = NULL
WHERE is_group = true
  AND (client_id IS NOT NULL OR lead_id IS NOT NULL);