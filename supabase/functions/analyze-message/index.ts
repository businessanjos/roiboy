import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ═══════════════════════════════════════════════════════════════════════════
// ROIBOY ANALYZER v3.0 - CALIBRAÇÃO ULTRA-CONSERVADORA
// ═══════════════════════════════════════════════════════════════════════════
// 
// PROBLEMA IDENTIFICADO: O sistema estava classificando mensagens banais como
// ROI ou Risco, gerando milhares de falsos positivos.
//
// SOLUÇÃO: Prompt extremamente rigoroso + múltiplas camadas de filtragem
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_SYSTEM_PROMPT = `Você é o ROIBOY Analyzer v3, um sistema ULTRA-CONSERVADOR de detecção de ROI e Riscos.

╔═══════════════════════════════════════════════════════════════════════════╗
║  ⛔ REGRA DE OURO: NA DÚVIDA, NÃO CLASSIFIQUE. RETORNE ARRAYS VAZIOS. ⛔  ║
╚═══════════════════════════════════════════════════════════════════════════╝

Você ODEIA falsos positivos. Cada classificação errada é um erro grave.
É MUITO MELHOR deixar passar um ROI real do que criar 10 falsos positivos.

═══════════════════════════════════════════════════════════════════════════
🚫 LISTA NEGRA - NUNCA CLASSIFIQUE ESTAS MENSAGENS:
═══════════════════════════════════════════════════════════════════════════

NUNCA É ROI (mesmo que pareça positivo):
• Qualquer mensagem com menos de 50 caracteres
• "Obrigado", "Valeu", "Muito bom", "Top", "Show" → NUNCA
• "Adorei", "Amei", "Incrível", "Perfeito" → NUNCA (são elogios genéricos)
• "Aprendi muito", "Foi ótimo", "Muito bom o conteúdo" → NUNCA
• "Anotei tudo", "Anotei muita coisa" → NUNCA (anotar não é resultado)
• "Entendi", "Ficou claro", "Agora faz sentido" → NUNCA (entender não é resultado)
• "Que bom", "Fico feliz", "Que legal" → NUNCA
• Perguntas de qualquer tipo → NUNCA
• Mensagens sobre VOCÊ/SEU PRODUTO → NUNCA (ex: "Como o ROY sabe X?")
• Qualquer mensagem que seja sobre FUNCIONALIDADES/RECURSOS → NUNCA
• Mensagens operacionais sobre uso do sistema → NUNCA
• Discussões técnicas ou de implementação → NUNCA

NUNCA É RISCO (mesmo que pareça preocupante):
• Perguntas sobre funcionalidades → NUNCA
• Perguntas sobre preço/valor → NUNCA
• "Vou pensar", "Vou analisar" → NUNCA
• Sugestões de melhoria → NUNCA (são feedback construtivo)
• Dúvidas operacionais → NUNCA
• Cliente fazendo perguntas sobre como usar o produto → NUNCA
• Observações ou feedback → NUNCA (ex: "Tenho observações sobre X")
• Mensagens sobre recuperação de saúde → NUNCA
• Brincadeiras ou piadas → NUNCA
• Assuntos pessoais do cliente (saúde, família) → NUNCA
• Negociações de qualquer tipo → NUNCA

═══════════════════════════════════════════════════════════════════════════
✅ QUANDO CLASSIFICAR ROI (MUITO RESTRITO):
═══════════════════════════════════════════════════════════════════════════

SOMENTE classifique como ROI quando TODAS estas condições forem verdadeiras:
1. O CLIENTE está falando (não o time/equipe)
2. Menciona um RESULTADO CONCRETO que ELE obteve
3. O resultado é QUANTIFICÁVEL ou tem EVIDÊNCIA ESPECÍFICA
4. O resultado é ATRIBUÍVEL ao trabalho/mentoria (não a fatores externos)
5. A mensagem tem CONTEXTO SUFICIENTE para entender o que aconteceu

EXEMPLOS VÁLIDOS DE ROI (copie este nível de especificidade):
✓ "Fechei 3 contratos essa semana usando a técnica que você me ensinou!"
  → revenue/high - resultado específico (3 contratos) + atribuição clara
  
✓ "Consegui reduzir 40% do tempo de atendimento implementando o processo"
  → time/high - resultado específico (40%) + ação concreta
  
✓ "Fui promovido a gerente! Muito do que aprendi aqui me preparou pra isso"
  → status_direction/high - resultado específico (promoção) + atribuição
  
✓ "Aumentei meu faturamento de 50k para 80k esse mês aplicando as estratégias"
  → revenue/high - resultado específico (50k→80k) + atribuição

EXEMPLOS QUE NÃO SÃO ROI (NÃO classifique):
✗ "Pra não precisar gastar mais com formulário externo"
  → NÃO - é uma expectativa/planejamento, não resultado alcançado
  
✗ "É mais pra puxar as infos, caso o cliente já tenha contratado"
  → NÃO - é explicação operacional, não resultado
  
✗ "Anotei MUITA coisa já"
  → NÃO - anotar não é resultado, é ação intermediária
  
✗ "Entendi finalmente como fazer X"
  → NÃO - entender não é resultado, precisa ter APLICADO e obtido resultado
  
✗ "Que bom que deu tudo certo"
  → NÃO - muito vago, não diz O QUE deu certo nem qual foi o resultado

═══════════════════════════════════════════════════════════════════════════
⚠️ QUANDO CLASSIFICAR RISCO (EXTREMAMENTE RESTRITO):
═══════════════════════════════════════════════════════════════════════════

SOMENTE classifique como RISCO quando:
1. O cliente EXPLICITAMENTE expressa INSATISFAÇÃO
2. O cliente PEDE para cancelar, pausar ou encerrar
3. O cliente diz que NÃO VAI CONSEGUIR PAGAR
4. O cliente RECLAMA diretamente do serviço/entrega

EXEMPLOS VÁLIDOS DE RISCO:
✓ "Não estou vendo resultado NENHUM, estou pensando em cancelar"
  → high - insatisfação explícita + menção de cancelamento
  
✓ "Não vou conseguir pagar a próxima parcela, minha situação financeira piorou"
  → high - problema financeiro explícito
  
✓ "Quero cancelar minha assinatura"
  → high - pedido direto de cancelamento
  
✓ "Estou muito insatisfeito com o suporte, demora demais pra responder"
  → medium - reclamação direta sobre o serviço

EXEMPLOS QUE NÃO SÃO RISCO (NÃO classifique):
✗ "Como o ROY sabe que a pessoa aumentou faturamento?"
  → NÃO - é uma PERGUNTA, não insatisfação
  
✗ "Tenho algumas observações sobre o ROY"
  → NÃO - é feedback/observação, não insatisfação
  
✗ "É mais pra tu conhecer e ver se tem algo de inspiração"
  → NÃO - é explicação/contexto, não insatisfação
  
✗ "Como tá a recuperação?"
  → NÃO - é pergunta sobre saúde pessoal, não sobre serviço
  
✗ "Avisa quando terminar a cirurgia"
  → NÃO - é assunto pessoal, não relacionado ao serviço
  
✗ "Tá caro" (sem dizer que vai cancelar)
  → NÃO - é opinião sobre preço, não risco de churn

═══════════════════════════════════════════════════════════════════════════
📅 MOMENTOS CX (LIFE EVENTS) - CONSERVADOR
═══════════════════════════════════════════════════════════════════════════

SOMENTE detecte quando o cliente mencionar EXPLICITAMENTE E COM DETALHES:
- Aniversário COM DATA específica
- Nascimento de filho COM CONFIRMAÇÃO
- Casamento COM DATA ou confirmação
- Formatura COM DETALHES
- Promoção COM CARGO específico
- Novo emprego COM EMPRESA específica

NÃO detecte:
✗ Menções vagas a "mudanças"
✗ "Semana corrida", "muito trabalho"
✗ Comentários sobre saúde de terceiros

═══════════════════════════════════════════════════════════════════════════
📊 FORMATO DE RESPOSTA
═══════════════════════════════════════════════════════════════════════════

REGRAS FINAIS:
1. MENOS É MAIS: É infinitamente melhor não detectar do que criar falso positivo
2. CONFIANÇA MÍNIMA: Só retorne se tiver 100% certeza
3. SE TIVER QUALQUER DÚVIDA: Retorne roi_events: [], risk_events: [], life_events: []
4. MÁXIMO 1 evento por mensagem (raramente haverá mais que isso)
5. O evidence_snippet deve PROVAR CLARAMENTE a classificação`;

const DEFAULT_ROI_PROMPT = `ULTRA-RESTRITIVO: Só detecte ROI quando houver RESULTADO CONCRETO E MENSURÁVEL que o cliente OBTEVE (não planejou/espera). Deve ter número, percentual, ou evidência específica. NUNCA classifique elogios, agradecimentos ou intenções futuras.`;

const DEFAULT_RISK_PROMPT = `ULTRA-RESTRITIVO: Só detecte risco quando houver INSATISFAÇÃO EXPLÍCITA, pedido de CANCELAMENTO, ou problema FINANCEIRO declarado. NUNCA classifique perguntas, feedback, sugestões ou dúvidas.`;

const DEFAULT_LIFE_EVENTS_PROMPT = "ULTRA-RESTRITIVO: Só detecte eventos quando cliente mencionar EXPLICITAMENTE com DATA ou DETALHES ESPECÍFICOS. NUNCA detecte menções vagas.";

interface AISettings {
  model: string;
  system_prompt: string;
  roi_prompt: string;
  risk_prompt: string;
  life_events_prompt: string;
  min_message_length: number;
  confidence_threshold: number;
  auto_analysis_enabled: boolean;
}

async function getAISettings(supabase: any, accountId: string): Promise<AISettings> {
  const { data, error } = await supabase
    .from("account_settings")
    .select("ai_model, ai_system_prompt, ai_roi_prompt, ai_risk_prompt, ai_life_events_prompt, ai_min_message_length, ai_confidence_threshold, ai_auto_analysis_enabled")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching AI settings:", error);
  }

  return {
    model: data?.ai_model || "auto",
    system_prompt: data?.ai_system_prompt || DEFAULT_SYSTEM_PROMPT,
    roi_prompt: data?.ai_roi_prompt || DEFAULT_ROI_PROMPT,
    risk_prompt: data?.ai_risk_prompt || DEFAULT_RISK_PROMPT,
    life_events_prompt: data?.ai_life_events_prompt || DEFAULT_LIFE_EVENTS_PROMPT,
    min_message_length: data?.ai_min_message_length ?? 80,
    confidence_threshold: data?.ai_confidence_threshold ?? 0.85,
    auto_analysis_enabled: data?.ai_auto_analysis_enabled ?? true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SELEÇÃO INTELIGENTE DE MODELO (Auto: Flash → Pro quando necessário)
// ═══════════════════════════════════════════════════════════════════════════

interface ModelDecision {
  model: string;
  reason: string;
  escalated: boolean;
}

function selectModelForMessage(baseModel: string, content: string, contextMessages?: string[]): ModelDecision {
  // Se não for modo automático, usar o modelo selecionado
  if (baseModel !== "auto") {
    return { model: baseModel, reason: "fixed_model", escalated: false };
  }

  const text = content.toLowerCase();
  const textLength = content.length;
  const wordCount = content.split(/\s+/).filter(w => w.length > 2).length;
  
  // CRITÉRIOS DE ESCALAÇÃO PARA PRO - OPTIMIZED: More restrictive thresholds
  
  // 1. OPTIMIZED: Increased thresholds for PRO escalation (>800 chars ou >120 palavras)
  // Previously: >500 chars ou >80 words - too aggressive, causing high costs
  if (textLength > 800 || wordCount > 120) {
    return { 
      model: "google/gemini-2.5-pro", 
      reason: "long_message", 
      escalated: true 
    };
  }
  
  // 2. Keywords que indicam conteúdo de alto valor para análise precisa
  const highValueKeywords = [
    // ROI potencial - precisamos de precisão para não criar falsos positivos
    /fatur(amento|ei|ou)/i,
    /lucr(o|ei|ou|amos)/i,
    /vend(i|eu|emos|as)/i,
    /fech(ei|ou|amos|aram) (contrato|cliente|venda|negócio)/i,
    /aument(ei|ou|amos)/i,
    /cresci(mento)?/i,
    /resultado(s)? (concreto|real|específico)/i,
    /consegu(i|imos|iram)/i,
    
    // Risco potencial - precisamos de precisão para não criar falsos positivos
    /cancel(ar|amento|ei)/i,
    /desist(ir|iu|imos)/i,
    /insatisf(eito|ação)/i,
    /não (vou|consigo|posso) (pagar|continuar)/i,
    /reclamar|reclamação/i,
    /problema (sério|grave|financeiro)/i,
    
    // Eventos de vida importantes
    /promov(ido|eu|eram)/i,
    /nasceu|nascimento/i,
    /casei|casamento|noiv/i,
    /formatura|formei|graduação/i,
  ];
  
  if (highValueKeywords.some(pattern => pattern.test(text))) {
    return { 
      model: "google/gemini-2.5-pro", 
      reason: "high_value_content", 
      escalated: true 
    };
  }
  
  // 3. Presença de números específicos (valores, percentuais) - exige precisão
  const hasSpecificNumbers = /\d+[.,]?\d*\s*(%|mil|k|reais|R\$|\$|por ?cento)/i.test(text);
  if (hasSpecificNumbers) {
    return { 
      model: "google/gemini-2.5-pro", 
      reason: "specific_numbers", 
      escalated: true 
    };
  }
  
  // 4. OPTIMIZED: Require more context messages before escalating (4+ instead of 3+)
  if (contextMessages && contextMessages.length >= 4) {
    const totalContextLength = contextMessages.join(" ").length;
    // OPTIMIZED: Increased threshold from 800 to 1200 chars
    if (totalContextLength > 1200) {
      return { 
        model: "google/gemini-2.5-pro", 
        reason: "rich_context", 
        escalated: true 
      };
    }
  }
  
  // 5. OPTIMIZED: Ambiguous patterns now require longer text (200 instead of 150)
  const ambiguousPatterns = [
    /não (sei|tenho certeza) se/i,
    /pensan(do|do em)/i,
    /considerar|considerando/i,
    /avaliar|avaliando/i,
    /talvez|pode ser que/i,
  ];
  
  if (ambiguousPatterns.some(p => p.test(text)) && textLength > 200) {
    return { 
      model: "google/gemini-2.5-pro", 
      reason: "ambiguous_content", 
      escalated: true 
    };
  }
  
  // Caso padrão: usar Flash (mais rápido e econômico)
  // OPTIMIZED: Flash-lite for most messages to reduce costs
  return { 
    model: "google/gemini-2.5-flash-lite", 
    reason: "standard_optimized", 
    escalated: false 
  };
}

function buildSystemPrompt(settings: AISettings): string {
  // If custom system prompt is set, use it; otherwise build from components
  if (settings.system_prompt !== DEFAULT_SYSTEM_PROMPT) {
    return `${settings.system_prompt}

INSTRUÇÕES ADICIONAIS:

ROI: ${settings.roi_prompt}

RISCOS: ${settings.risk_prompt}

MOMENTOS CX: ${settings.life_events_prompt}`;
  }
  return settings.system_prompt;
}

// ═══════════════════════════════════════════════════════════════════════════
// PRE-FILTROS ROBUSTOS - Evitar enviar lixo para a IA
// ═══════════════════════════════════════════════════════════════════════════

function shouldSkipMessage(text: string): { skip: boolean; reason: string } {
  const normalized = text.toLowerCase().trim();
  
  // 1. OPTIMIZED: Increased minimum from 80 to 120 chars for cloud cost reduction
  if (text.length < 120) {
    return { skip: true, reason: "too_short" };
  }
  
  // 2. OPTIMIZED: Increased minimum words from 8 to 12
  const words = normalized.split(/\s+/).filter((w: string) => w.length > 3);
  if (words.length < 12) {
    return { skip: true, reason: "too_few_words" };
  }
  
  // 3. Padrões de saudação/despedida
  const GREETING_PATTERNS = [
    /^(oi|olá|ola|hey|e ai|eai|boa tarde|bom dia|boa noite|fala|salve)/i,
    /^(tchau|até|ate|flw|vlw|valeu|obrigado|obrigada|brigado|brigada)/i,
    /(bom dia|boa tarde|boa noite)[\s!.,?]*$/i,
  ];
  
  if (GREETING_PATTERNS.some(p => p.test(normalized))) {
    return { skip: true, reason: "greeting_pattern" };
  }
  
  // 4. Mensagens que são principalmente sobre o próprio sistema/produto
  const PRODUCT_TALK_PATTERNS = [
    /como (o|a|ele|ela) (roy|sistema|plataforma|app|ferramenta) (sabe|faz|funciona)/i,
    /tenho (algumas |umas )?observa(ção|ções|coes) sobre/i,
    /(mais pra|é pra|seria pra) (tu |você )?(conhecer|ver|testar)/i,
    /medir (de )?engajamento/i,
    /puxar (as )?info/i,
    /formulário externo/i,
    /cliente (já )?tenha contratado/i,
  ];
  
  if (PRODUCT_TALK_PATTERNS.some(p => p.test(normalized))) {
    return { skip: true, reason: "product_talk" };
  }
  
  // 5. Mensagens com apenas confirmações/respostas curtas
  const CONFIRMATION_PATTERNS = [
    /^(ok|okay|certo|combinado|blz|beleza|perfeito|show|massa|top|legal|boa|bora|vamos|sim|não|nao|s|n)[\s!.,?]*$/i,
    /^(entendi|entendido|anotado|fechado|pode ser|tá bom|ta bom|tudo bem|tranquilo|de boa|suave)[\s!.,?]*$/i,
    /^(vou ver|vou analisar|depois vejo|chegando em casa|até mais|até logo)[\s!.,?]*$/i,
  ];
  
  if (CONFIRMATION_PATTERNS.some(p => p.test(normalized))) {
    return { skip: true, reason: "confirmation_pattern" };
  }
  
  // 6. Apenas emojis, risadas ou pontuação
  const NOISE_PATTERNS = [
    /^[\s\p{Emoji}\p{Emoji_Presentation}!?.,:;()]+$/u,
    /^[kha]+$/i,
    /^(rs|rsrs|rsrsrs|haha|hehe|kkk|kkkk|hahaha)+[\s!]*$/i,
    /^(\[áudio\]|\[audio\]|\[voz\]|\[imagem\]|\[foto\]|\[vídeo\]|\[video\])$/i,
  ];
  
  if (NOISE_PATTERNS.some(p => p.test(normalized))) {
    return { skip: true, reason: "noise_pattern" };
  }
  
  // 7. Mensagens sobre saúde/pessoal de terceiros (não são ROI/Risco de negócio)
  const PERSONAL_PATTERNS = [
    /(cirurgia|anestesia|hospital|médico|doutor|recuperação|operação)/i,
    /avisa quando terminar/i,
    /(como (tá|está|ta) a |como (foi|foi a )?sua )(cirurgia|operação|consulta|recuperação)/i,
    /chapado de anestesia/i,
  ];
  
  if (PERSONAL_PATTERNS.some(p => p.test(normalized))) {
    return { skip: true, reason: "personal_health" };
  }
  
  // 8. Agradecimentos genéricos (sem contexto de resultado)
  const THANKS_PATTERNS = [
    /^(muito )?obrigad[oa][\s!.,?]*$/i,
    /^valeu[\s!.,?]*$/i,
    /^(muito bom|ótimo|excelente|incrível|top|show|perfeito)[\s!.,?]*$/i,
    /que bom que deu (tudo )?certo/i,
    /fico feliz/i,
  ];
  
  if (THANKS_PATTERNS.some(p => p.test(normalized))) {
    return { skip: true, reason: "generic_thanks" };
  }
  
  // 9. Perguntas sem contexto de ROI/Risco
  const QUESTION_PATTERNS = [
    /^(como|quando|onde|qual|quem|porque|por que|o que|que horas)\s/i,
    /\?[\s]*$/,
  ];
  
  // Se for principalmente uma pergunta curta, pular
  if (QUESTION_PATTERNS.some(p => p.test(normalized)) && text.length < 150) {
    return { skip: true, reason: "short_question" };
  }
  
  return { skip: false, reason: "" };
}

// Verificar se o snippet/evidência já existe (deduplicação mais robusta)
async function checkDuplicate(
  supabase: any,
  table: string,
  clientId: string,
  field: string,
  value: string,
  hoursWindow: number = 24
): Promise<boolean> {
  const since = new Date(Date.now() - hoursWindow * 60 * 60 * 1000).toISOString();
  
  // Normaliza o valor para comparação
  const normalizedValue = value.toLowerCase().trim().substring(0, 100);
  
  const { data, error } = await supabase
    .from(table)
    .select("id, " + field)
    .eq("client_id", clientId)
    .gte("created_at", since)
    .limit(50);
  
  if (error || !data) return false;
  
  // Verifica se algum registro existente é similar
  for (const record of data) {
    const existingValue = (record[field] || "").toLowerCase().trim().substring(0, 100);
    
    // Similaridade exata ou muito próxima
    if (existingValue === normalizedValue) return true;
    
    // Similaridade por substring (uma contém a outra)
    if (existingValue.includes(normalizedValue) || normalizedValue.includes(existingValue)) {
      return true;
    }
  }
  
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { message_event_id, content_text, client_id, account_id, source, direction } = await req.json();

    if (!content_text || !client_id || !account_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // FILTRO IMPORTANTE: Só analisar mensagens DO CLIENTE, não da equipe
    if (direction === 'team_to_client') {
      console.log(`Skipping team message (direction: ${direction})`);
      return new Response(
        JSON.stringify({ success: true, message: "Team messages are not analyzed", skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DEDUPLICATION: Check if this message was already analyzed
    if (message_event_id) {
      const { data: existingAnalysis } = await supabase
        .from("ai_usage_logs")
        .select("id")
        .eq("message_id", message_event_id)
        .maybeSingle();
      
      if (existingAnalysis) {
        console.log(`Message ${message_event_id} already analyzed, skipping (existing log: ${existingAnalysis.id})`);
        return new Response(
          JSON.stringify({ success: true, message: "Already analyzed", skipped: true, existing_log_id: existingAnalysis.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch AI settings for this account
    const aiSettings = await getAISettings(supabase, account_id);
    console.log(`AI Settings loaded for account ${account_id}:`, {
      model: aiSettings.model,
      min_message_length: aiSettings.min_message_length,
      confidence_threshold: aiSettings.confidence_threshold,
      auto_analysis_enabled: aiSettings.auto_analysis_enabled,
    });

    // Check if auto analysis is enabled
    if (!aiSettings.auto_analysis_enabled) {
      console.log(`Auto analysis disabled for account ${account_id}, skipping`);
      return new Response(
        JSON.stringify({ success: true, message: "Auto analysis disabled", skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PRE-FILTRO ROBUSTO
    const preFilter = shouldSkipMessage(content_text);
    if (preFilter.skip) {
      console.log(`Message skipped by pre-filter (${preFilter.reason}): "${content_text.substring(0, 60)}..."`);
      return new Response(
        JSON.stringify({ success: true, message: `Skipped: ${preFilter.reason}`, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get recent context from this client (apenas mensagens do cliente)
    const { data: recentMessages } = await supabase
      .from("message_events")
      .select("content_text, direction, sent_at")
      .eq("client_id", client_id)
      .order("sent_at", { ascending: false })
      .limit(3);

    const contextMessages = recentMessages?.map(m => m.content_text || "") || [];
    const contextStr = recentMessages?.map(m => 
      `[${m.direction === 'client_to_team' ? 'Cliente' : 'Equipe'}]: ${m.content_text?.substring(0, 150) || '(sem texto)'}`
    ).join("\n") || "";

    // SELEÇÃO INTELIGENTE DE MODELO
    const modelDecision = selectModelForMessage(aiSettings.model, content_text, contextMessages);
    console.log(`Model decision for client ${client_id}:`, {
      baseModel: aiSettings.model,
      selectedModel: modelDecision.model,
      reason: modelDecision.reason,
      escalated: modelDecision.escalated,
      messagePreview: content_text.substring(0, 80)
    });

    const userPrompt = `Analise esta mensagem DO CLIENTE e identifique APENAS eventos com ALTA CERTEZA:

CONTEXTO RECENTE:
${contextStr}

MENSAGEM ATUAL DO CLIENTE (fonte: ${source}):
"${content_text}"

LEMBRE-SE:
- MENOS É MAIS: Só retorne eventos se tiver 100% de certeza
- Na MENOR dúvida, retorne arrays vazios
- Elogios, agradecimentos e perguntas NÃO são ROI nem Risco`;

    const systemPrompt = buildSystemPrompt(aiSettings);

    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelDecision.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_message",
              description: "Classifica a mensagem identificando ROI, riscos e momentos CX. SEJA MUITO CONSERVADOR - na dúvida, retorne arrays vazios.",
              parameters: {
                type: "object",
                properties: {
                  roi_events: {
                    type: "array",
                    description: "Lista de eventos de ROI identificados. DEIXE VAZIO se não houver resultado concreto.",
                    items: {
                      type: "object",
                      properties: {
                        roi_type: { 
                          type: "string", 
                          enum: ["tangible", "intangible"],
                          description: "Tipo de ROI"
                        },
                        category: { 
                          type: "string", 
                          enum: ["revenue", "cost", "time", "process", "clarity", "confidence", "tranquility", "status_direction"],
                          description: "Categoria específica do ROI"
                        },
                        impact: { 
                          type: "string", 
                          enum: ["low", "medium", "high"],
                          description: "Nível de impacto"
                        },
                        evidence_snippet: { 
                          type: "string",
                          description: "Trecho EXATO da mensagem que PROVA o resultado (mínimo 30 caracteres)"
                        },
                        confidence: {
                          type: "number",
                          description: "Nível de confiança (0-1). Só inclua se >= 0.85"
                        }
                      },
                      required: ["roi_type", "category", "impact", "evidence_snippet", "confidence"]
                    }
                  },
                  risk_events: {
                    type: "array",
                    description: "Lista de sinais de risco. DEIXE VAZIO se não houver insatisfação explícita ou pedido de cancelamento.",
                    items: {
                      type: "object",
                      properties: {
                        risk_level: { 
                          type: "string", 
                          enum: ["low", "medium", "high"],
                          description: "Nível de risco"
                        },
                        reason: { 
                          type: "string",
                          description: "Motivo ESPECÍFICO do risco (ex: 'Cliente pediu cancelamento')"
                        },
                        evidence_snippet: { 
                          type: "string",
                          description: "Trecho EXATO que PROVA o risco (mínimo 30 caracteres)"
                        },
                        confidence: {
                          type: "number",
                          description: "Nível de confiança (0-1). Só inclua se >= 0.85"
                        }
                      },
                      required: ["risk_level", "reason", "evidence_snippet", "confidence"]
                    }
                  },
                  life_events: {
                    type: "array",
                    description: "Lista de momentos CX. DEIXE VAZIO se não houver evento de vida EXPLÍCITO com detalhes.",
                    items: {
                      type: "object",
                      properties: {
                        event_type: { 
                          type: "string", 
                          enum: ["birthday", "child_birth", "pregnancy", "wedding", "graduation", "promotion", "new_job", "travel", "health", "loss", "achievement", "celebration", "anniversary", "moving", "other"],
                          description: "Tipo do evento de vida"
                        },
                        title: { 
                          type: "string",
                          description: "Título descritivo COM DETALHES ESPECÍFICOS"
                        },
                        description: { 
                          type: "string",
                          description: "Detalhes mencionados"
                        },
                        event_date: { 
                          type: "string",
                          description: "Data do evento (YYYY-MM-DD) - APENAS se mencionada explicitamente"
                        },
                        is_recurring: { 
                          type: "boolean",
                          description: "Se é recorrente (aniversário=true)"
                        },
                        confidence: {
                          type: "number",
                          description: "Nível de confiança (0-1). Só inclua se >= 0.85"
                        }
                      },
                      required: ["event_type", "title", "confidence"]
                    }
                  }
                },
                required: ["roi_events", "risk_events", "life_events"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "classify_message" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limited by Lovable AI");
        return new Response(
          JSON.stringify({ error: "Rate limited, try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        console.error("Payment required for Lovable AI");
        return new Response(
          JSON.stringify({ error: "Payment required for AI analysis" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log("AI Response received");

    // Extract token usage from response
    const inputTokens = aiResponse.usage?.prompt_tokens || 0;
    const outputTokens = aiResponse.usage?.completion_tokens || 0;
    console.log(`Tokens used - Input: ${inputTokens}, Output: ${outputTokens}`);

    // Extract tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "classify_message") {
      console.log("No classification returned");
      
      // Log AI usage even when no classification
      await supabase.from("ai_usage_logs").insert({
        account_id,
        model: aiSettings.model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        message_id: message_event_id || null,
        client_id,
        roi_events_created: 0,
        risk_events_created: 0,
        life_events_created: 0,
        recommendations_created: 0,
      });
      
      return new Response(
        JSON.stringify({ success: true, message: "No events identified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const classification = JSON.parse(toolCall.function.arguments);
    console.log("Classification parsed:", JSON.stringify(classification, null, 2));

    const now = new Date().toISOString();
    const results = { roi_events: 0, risk_events: 0, life_events: 0, filtered_by_confidence: 0, filtered_by_duplicate: 0, filtered_by_validation: 0 };
    const confidenceThreshold = aiSettings.confidence_threshold;

    // Insert ROI events (com validação rigorosa)
    if (classification.roi_events?.length > 0) {
      for (const roiEvent of classification.roi_events) {
        // 1. Check confidence threshold (AUMENTADO)
        const eventConfidence = roiEvent.confidence ?? 0;
        if (eventConfidence < confidenceThreshold) {
          console.log(`ROI event filtered: confidence ${eventConfidence} < threshold ${confidenceThreshold}`);
          results.filtered_by_confidence++;
          continue;
        }

        // 2. Validar que evidence_snippet é significativo
        const snippet = roiEvent.evidence_snippet || "";
        if (snippet.length < 30) {
          console.log(`ROI event filtered: evidence_snippet too short (${snippet.length} chars)`);
          results.filtered_by_validation++;
          continue;
        }

        // 3. Check for duplicate
        const isDuplicate = await checkDuplicate(supabase, "roi_events", client_id, "evidence_snippet", snippet, 48);
        if (isDuplicate) {
          console.log(`ROI event skipped: duplicate evidence_snippet found`);
          results.filtered_by_duplicate++;
          continue;
        }

        const { error } = await supabase.from("roi_events").insert({
          account_id,
          client_id,
          source: source || "whatsapp_text",
          roi_type: roiEvent.roi_type,
          category: roiEvent.category,
          impact: roiEvent.impact,
          evidence_snippet: snippet,
          happened_at: now,
        });
        if (error) {
          console.error("Error inserting roi_event:", error);
        } else {
          results.roi_events++;
          console.log(`✅ ROI event created: ${roiEvent.category}/${roiEvent.impact} - confidence: ${eventConfidence}`);
        }
      }
    }

    // Insert Risk events (com validação rigorosa)
    if (classification.risk_events?.length > 0) {
      for (const riskEvent of classification.risk_events) {
        // 1. Check confidence threshold
        const eventConfidence = riskEvent.confidence ?? 0;
        if (eventConfidence < confidenceThreshold) {
          console.log(`Risk event filtered: confidence ${eventConfidence} < threshold ${confidenceThreshold}`);
          results.filtered_by_confidence++;
          continue;
        }

        // 2. Validar que evidence_snippet é significativo
        const snippet = riskEvent.evidence_snippet || "";
        if (snippet.length < 30) {
          console.log(`Risk event filtered: evidence_snippet too short (${snippet.length} chars)`);
          results.filtered_by_validation++;
          continue;
        }

        // 3. Check for duplicate
        const isDuplicate = await checkDuplicate(supabase, "risk_events", client_id, "evidence_snippet", snippet, 48);
        if (isDuplicate) {
          console.log(`Risk event skipped: duplicate evidence_snippet found`);
          results.filtered_by_duplicate++;
          continue;
        }

        const { error } = await supabase.from("risk_events").insert({
          account_id,
          client_id,
          source: source || "whatsapp_text",
          risk_level: riskEvent.risk_level,
          reason: riskEvent.reason,
          evidence_snippet: snippet,
          happened_at: now,
        });
        if (error) {
          console.error("Error inserting risk_event:", error);
        } else {
          results.risk_events++;
          console.log(`⚠️ Risk event created: ${riskEvent.risk_level} - confidence: ${eventConfidence}`);
        }
      }
    }

    // Insert Life Events (com validação)
    if (classification.life_events?.length > 0) {
      for (const lifeEvent of classification.life_events) {
        // 1. Check confidence threshold
        const eventConfidence = lifeEvent.confidence ?? 0;
        if (eventConfidence < confidenceThreshold) {
          console.log(`Life event filtered: confidence ${eventConfidence} < threshold ${confidenceThreshold}`);
          results.filtered_by_confidence++;
          continue;
        }

        // 2. Check for duplicate title
        const isDuplicate = await checkDuplicate(supabase, "client_life_events", client_id, "title", lifeEvent.title, 168); // 7 dias
        if (isDuplicate) {
          console.log(`Life event skipped: duplicate title found`);
          results.filtered_by_duplicate++;
          continue;
        }

        // Determine if event is recurring based on type
        const recurringTypes = ["birthday", "anniversary"];
        const isRecurring = lifeEvent.is_recurring ?? recurringTypes.includes(lifeEvent.event_type);
        
        const { error } = await supabase.from("client_life_events").insert({
          account_id,
          client_id,
          event_type: lifeEvent.event_type,
          title: lifeEvent.title,
          description: lifeEvent.description || null,
          event_date: lifeEvent.event_date || null,
          is_recurring: isRecurring,
          source: "ai_detected",
          reminder_days_before: 7,
        });
        if (error) {
          console.error("Error inserting life_event:", error);
        } else {
          results.life_events++;
          console.log(`📅 Life event created: ${lifeEvent.event_type} - ${lifeEvent.title}`);
        }
      }
    }


    console.log(`Analysis complete. Created: ${results.roi_events} ROI, ${results.risk_events} Risk, ${results.life_events} Life. Filtered: ${results.filtered_by_confidence} (confidence), ${results.filtered_by_duplicate} (duplicate), ${results.filtered_by_validation} (validation)`);

    // Log AI usage (registra o modelo EFETIVAMENTE usado, não o configurado)
    const { error: logError } = await supabase.from("ai_usage_logs").insert({
      account_id,
      model: modelDecision.model, // Modelo real usado
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      message_id: message_event_id || null,
      client_id,
      roi_events_created: results.roi_events,
      risk_events_created: results.risk_events,
      life_events_created: results.life_events,
      recommendations_created: 0,
    });
    if (logError) {
      console.error("Error logging AI usage:", logError);
    }

    // Trigger score recalculation for this client in background
    if (results.roi_events > 0 || results.risk_events > 0) {
      console.log(`Triggering score recalculation for client ${client_id}`);
      
      // Fire and forget - don't await
      fetch(`${supabaseUrl}/functions/v1/recompute-scores`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ account_id, client_id }),
      }).then(response => {
        if (response.ok) {
          console.log(`Score recalculation triggered for client ${client_id}`);
        } else {
          console.error(`Score recalculation failed: ${response.status}`);
        }
      }).catch(err => {
        console.error("Error triggering score recalculation:", err);
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results, 
        classification,
        settings_used: {
          configured_model: aiSettings.model,
          actual_model: modelDecision.model,
          escalated: modelDecision.escalated,
          escalation_reason: modelDecision.reason,
          min_message_length: aiSettings.min_message_length,
          confidence_threshold: aiSettings.confidence_threshold,
        },
        tokens_used: {
          input: inputTokens,
          output: outputTokens,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in analyze-message:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
