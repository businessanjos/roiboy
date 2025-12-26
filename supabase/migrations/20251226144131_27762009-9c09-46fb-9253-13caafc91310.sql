-- Update the initialize function with the actual functions ROY performs
CREATE OR REPLACE FUNCTION public.initialize_ai_agent_functions(p_account_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete existing functions to replace with correct ones
  DELETE FROM public.ai_agent_functions WHERE account_id = p_account_id;
  
  -- Insert the actual functions ROY performs
  INSERT INTO public.ai_agent_functions (account_id, function_key, function_name, description, instructions, display_order, is_enabled)
  VALUES 
    (p_account_id, 'roi_detection', 'Medir ROI', 
     'Identifica sinais de retorno sobre investimento nas conversas - ganhos tangíveis (receita, economia) e intangíveis (confiança, clareza).',
     'Identifique menções a ganhos que o cliente obteve:

**ROI Tangível:**
- Aumento de receita ou faturamento
- Economia de custos ou tempo
- Novos contratos fechados
- Metas batidas

**ROI Intangível:**
- Confiança e segurança
- Clareza e direção
- Tranquilidade
- Reconhecimento

Seja conservador. Só registre quando houver evidência clara de resultado positivo.',
     1, true),
     
    (p_account_id, 'risk_detection', 'Medir Riscos', 
     'Detecta sinais de insatisfação, frustração ou risco de churn nas conversas dos clientes.',
     'Detecte sinais de risco na relação com o cliente:

**Alto Risco:**
- Menção a cancelamento ou desistência
- Comparação com concorrentes
- Frustração explícita com resultados
- Reclamações recorrentes

**Médio Risco:**
- Questionamentos sobre valor
- Atrasos em pagamentos mencionados
- Redução de engajamento
- Tom negativo persistente

**Baixo Risco:**
- Dúvidas sobre próximos passos
- Pequenas insatisfações pontuais

Priorize a detecção precoce para ação preventiva.',
     2, true),
     
    (p_account_id, 'life_events', 'Momentos CX', 
     'Captura eventos de vida importantes do cliente para oportunidades de relacionamento e celebração.',
     'Identifique eventos de vida significativos:

**Pessoais:**
- Aniversários (cliente, cônjuge, filhos)
- Casamentos e noivados
- Nascimentos e gravidez
- Formaturas

**Profissionais:**
- Promoções e mudança de cargo
- Novo emprego
- Abertura de empresa
- Conquistas de carreira

**Viagens e Marcos:**
- Viagens importantes
- Mudança de cidade/país
- Aposentadoria
- Compra de imóvel/carro

Registre a data quando mencionada para lembretes futuros.',
     3, true),
     
    (p_account_id, 'engagement_score', 'Calcular E-Score', 
     'Analisa o nível de engajamento do cliente baseado na frequência e qualidade das interações.',
     'Avalie o engajamento do cliente considerando:

**Indicadores Positivos:**
- Frequência de mensagens
- Participação em lives e eventos
- Respostas rápidas
- Perguntas e interesse ativo
- Compartilhamento de resultados

**Indicadores Negativos:**
- Silêncio prolongado
- Respostas monossilábicas
- Ausência em eventos
- Demora para responder

Use para identificar clientes que precisam de atenção.',
     4, true),
     
    (p_account_id, 'vnps_eligibility', 'Identificar Promotores', 
     'Identifica clientes com potencial para serem promotores (vNPS) baseado em sinais positivos.',
     'Identifique clientes promotores através de:

**Sinais Fortes:**
- Elogios espontâneos
- Indicações mencionadas
- Depoimentos oferecidos
- Defesa da marca

**Sinais Moderados:**
- Satisfação expressa
- Resultados compartilhados
- Engajamento consistente
- Renovações sem hesitação

Clientes promotores são candidatos a:
- Depoimentos e cases
- Programa de indicação
- Eventos exclusivos',
     5, true),
     
    (p_account_id, 'support_requests', 'Detectar Pedidos', 
     'Identifica solicitações de suporte, dúvidas ou pedidos que precisam de ação da equipe.',
     'Detecte pedidos que requerem ação:

**Urgente:**
- Problemas técnicos
- Reclamações que precisam resposta
- Solicitações de cancelamento
- Dúvidas críticas

**Normal:**
- Perguntas sobre serviços
- Pedidos de material
- Agendamentos
- Dúvidas operacionais

**Informativo:**
- Atualizações de status
- Confirmações
- Feedbacks gerais

Classifique para priorização do atendimento.',
     6, false);
END;
$$;

-- Update existing accounts with new functions
DO $$
DECLARE
  acc_record RECORD;
BEGIN
  FOR acc_record IN SELECT DISTINCT account_id FROM public.ai_agent_functions
  LOOP
    PERFORM public.initialize_ai_agent_functions(acc_record.account_id);
  END LOOP;
END;
$$;