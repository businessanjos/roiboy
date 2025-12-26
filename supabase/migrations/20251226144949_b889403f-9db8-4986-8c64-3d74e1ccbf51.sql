
-- Update the initialize_ai_agent_functions to use "V-NPS (Promotores)" as the name
CREATE OR REPLACE FUNCTION public.initialize_ai_agent_functions(p_account_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.ai_agent_functions WHERE account_id = p_account_id;
  
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
     
    (p_account_id, 'vnps_eligibility', 'V-NPS (Promotores)', 
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
     
    (p_account_id, 'support_requests', 'Central de Suporte', 
     'Analisa e categoriza tickets de suporte, identificando prioridade e encaminhando para atendimento adequado.',
     'Analise tickets de suporte para:

**Categorização:**
- Dúvidas técnicas
- Problemas de acesso
- Solicitações de funcionalidades
- Reclamações
- Elogios e feedbacks

**Priorização:**
- Urgente: Sistema fora do ar, erro crítico
- Alta: Funcionalidade bloqueada
- Média: Dúvidas operacionais
- Baixa: Sugestões e melhorias

**Encaminhamento:**
- Identifique se precisa de atendimento humano
- Sugira respostas da base de conhecimento
- Detecte padrões recorrentes

Sempre peça evidências (prints, vídeos) quando necessário.',
     6, true);
END;
$function$;
