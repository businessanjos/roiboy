-- Add AI analysis flag to whatsapp_groups
ALTER TABLE public.whatsapp_groups 
ADD COLUMN ai_analysis_enabled BOOLEAN NOT NULL DEFAULT false;

-- Add index for quick filtering
CREATE INDEX idx_whatsapp_groups_ai_analysis ON public.whatsapp_groups(account_id, ai_analysis_enabled) WHERE ai_analysis_enabled = true;

-- Add comment
COMMENT ON COLUMN public.whatsapp_groups.ai_analysis_enabled IS 'Se habilitado, a IA analisa mensagens do grupo buscando sinais de ROI, riscos, atendimento etc.';