-- Create AI agent functions configuration table
CREATE TABLE public.ai_agent_functions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  function_key TEXT NOT NULL,
  function_name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  instructions TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, function_key)
);

-- Enable RLS
ALTER TABLE public.ai_agent_functions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their account AI functions"
ON public.ai_agent_functions FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can update their account AI functions"
ON public.ai_agent_functions FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert AI functions for their account"
ON public.ai_agent_functions FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can delete their account AI functions"
ON public.ai_agent_functions FOR DELETE
USING (account_id = get_user_account_id());

-- Trigger for updated_at
CREATE TRIGGER update_ai_agent_functions_updated_at
BEFORE UPDATE ON public.ai_agent_functions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to initialize default AI functions for an account
CREATE OR REPLACE FUNCTION public.initialize_ai_agent_functions(p_account_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert default functions if they don't exist
  INSERT INTO public.ai_agent_functions (account_id, function_key, function_name, description, instructions, display_order)
  VALUES 
    (p_account_id, 'message_analysis', 'Análise de Mensagens', 
     'Analisa mensagens de WhatsApp para identificar sinais de ROI, riscos e eventos de vida dos clientes.',
     'Analise as mensagens buscando:
- **ROI**: Menções a resultados positivos, conquistas, crescimento, vendas, faturamento
- **Riscos**: Insatisfação, reclamações, dificuldades, cancelamento, concorrência
- **Eventos de Vida**: Aniversários, casamentos, nascimentos, mudanças, viagens

Seja conservador na classificação. Só registre eventos com alta confiança.',
     1),
    (p_account_id, 'sentiment_analysis', 'Análise de Sentimento', 
     'Detecta o sentimento predominante nas conversas (positivo, neutro, negativo).',
     'Classifique o sentimento da mensagem como:
- **Positivo**: Satisfação, entusiasmo, gratidão
- **Neutro**: Informações, perguntas simples
- **Negativo**: Frustração, reclamação, insatisfação

Considere o contexto completo da conversa.',
     2),
    (p_account_id, 'auto_tagging', 'Marcação Automática', 
     'Sugere tags automaticamente para clientes baseado nas conversas.',
     'Sugira tags relevantes baseado no conteúdo das mensagens:
- Interesses do cliente
- Produtos mencionados
- Fase do relacionamento
- Nível de engajamento',
     3),
    (p_account_id, 'summary_generation', 'Resumo de Conversas', 
     'Gera resumos automáticos das conversas para facilitar o acompanhamento.',
     'Crie resumos concisos das conversas incluindo:
- Principais assuntos discutidos
- Ações pendentes
- Próximos passos acordados
- Pontos de atenção',
     4)
  ON CONFLICT (account_id, function_key) DO NOTHING;
END;
$$;

-- Index for performance
CREATE INDEX idx_ai_agent_functions_account ON public.ai_agent_functions(account_id);
CREATE INDEX idx_ai_agent_functions_enabled ON public.ai_agent_functions(account_id, is_enabled) WHERE is_enabled = true;