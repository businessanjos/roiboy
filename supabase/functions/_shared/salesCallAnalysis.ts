/**
 * Análise de call de vendas usada tanto pelo botão "Analisar" (analyze-sales-call)
 * quanto pela rotina automática das calls que chegam do Google Meet.
 * Mantém um único prompt e um único modelo para as duas rotas.
 */

export type GatewayOutcome = "ok" | "retry" | "pause" | "fail";

/** Decide o que fazer com um status do gateway de IA: repetir, pausar a fila ou desistir. */
export function classifyGatewayStatus(status: number): GatewayOutcome {
  if (status < 400) return "ok";
  if (status === 402 || status === 403) return "pause";
  if (status === 429 || status >= 500) return "retry";
  return "fail";
}

export class SalesCallAnalysisError extends Error {
  status: number;
  outcome: GatewayOutcome;
  constructor(message: string, status: number) {
    super(message);
    this.name = "SalesCallAnalysisError";
    this.status = status;
    this.outcome = classifyGatewayStatus(status);
  }
}

export const SALES_CALL_SYSTEM_PROMPT = `Você é um especialista em vendas e coaching comercial. Analise a transcrição de uma call de vendas e retorne uma análise COMPLETA e DETALHADA em português brasileiro.

ESTRUTURA OBRIGATÓRIA DA ANÁLISE:

## 📊 Resumo Geral
- Duração estimada da call
- Resultado (venda fechada, follow-up, perdida, etc.)
- Nota geral do vendedor (0-10)

## 🚫 Objeções Identificadas
Para CADA objeção encontrada:
- **Objeção:** O que o lead disse
- **Momento:** Em que contexto surgiu
- **Como o vendedor reagiu:** O que fez (ou não fez)
- **Rebatimento sugerido:** Como deveria ter respondido

## ❌ Erros do Vendedor
Liste TODOS os erros identificados com descrição, problema e solução.

## ✅ Pontos Fortes
O que o vendedor fez bem.

## 🎯 Diagnóstico de Perdas
- Por que a venda não avançou
- Principal gap de habilidade
- Nível de preparo (1-10)

## 📝 Script Melhorado
Reescreva as partes mais críticas como deveriam ter sido conduzidas.

## 🔑 Top 3 Ações Imediatas
Ações práticas e específicas para a próxima call.

IMPORTANTE: Seja DIRETO e ESPECÍFICO. Use exemplos reais da transcrição.`;

const AUDIT_TAIL = `

AUDITORIA OBRIGATÓRIA: avalie se o vendedor seguiu as etapas do processo comercial do manual, se fez as perguntas de descoberta obrigatórias, se checou os critérios de qualificação e se respeitou as correções aprendidas. Cite explicitamente as etapas cumpridas e as puladas, e reduza a nota quando o vendedor usar uma abordagem marcada como incorreta.`;

export function buildSalesCallAuditPrompt(knowledgeBlock: string): string {
  return knowledgeBlock ? `${SALES_CALL_SYSTEM_PROMPT}${knowledgeBlock}${AUDIT_TAIL}` : SALES_CALL_SYSTEM_PROMPT;
}

const ANALYSIS_MODEL = "google/gemini-3-flash-preview";
const ICP_MODEL = "google/gemini-3.1-pro-preview";

async function gatewayFetch(apiKey: string, body: Record<string, unknown>) {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/**
 * Roda a análise completa da transcrição: texto da auditoria + sinais de ICP.
 * Lança SalesCallAnalysisError quando o gateway de IA recusa a chamada.
 */
export async function runSalesCallAnalysis(opts: {
  transcript: string;
  knowledgeBlock: string;
  apiKey: string;
}): Promise<{ analysis: string; icp_signals: Record<string, unknown> | null }> {
  const { transcript, knowledgeBlock, apiKey } = opts;
  const auditPrompt = buildSalesCallAuditPrompt(knowledgeBlock);

  const response = await gatewayFetch(apiKey, {
    model: ANALYSIS_MODEL,
    messages: [
      { role: "system", content: auditPrompt },
      { role: "user", content: `Analise esta transcrição de call de vendas:\n\n${transcript}` },
    ],
    max_tokens: 4000,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("AI gateway error:", response.status, text);
    throw new SalesCallAnalysisError("Erro ao processar análise com IA", response.status);
  }

  const data = await response.json();
  const analysis = data.choices?.[0]?.message?.content || "Não foi possível gerar a análise.";

  // Segunda passada: extrai sinais de ICP. Melhor esforço — se falhar, a análise ainda vale.
  let icp_signals: Record<string, unknown> | null = null;
  try {
    const icpResp = await gatewayFetch(apiKey, {
      model: ICP_MODEL,
      messages: [
        { role: "system", content: "Você extrai sinais de ICP de uma transcrição de call de vendas. Retorne SEMPRE em português, conciso e factual. Quando não houver evidência, retorne null ou array vazio — NUNCA invente. Para 'niche_combined' SEMPRE construa profissão + área (ex: 'Médico que atua com emagrecimento', 'Biomédica que atua com harmonização facial') quando houver pelo menos uma pista de profissão E de área." },
        { role: "user", content: `Transcrição da call:\n\n${transcript.substring(0, 14000)}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "save_icp_signals",
          description: "Salva sinais de ICP extraídos da call.",
          parameters: {
            type: "object",
            properties: {
              profession: { type: ["string", "null"], description: "Profissão principal (ex: Médico, Dentista, Biomédica, Empresário)" },
              specialty: { type: ["string", "null"], description: "Especialidade/área de atuação (ex: Emagrecimento, Harmonização facial)" },
              niche_combined: { type: ["string", "null"], description: "Profissão + especialidade em uma frase (ex: 'Médico que atua com emagrecimento')" },
              business_model: { type: ["string", "null"], description: "Modelo de negócio (ex: Clínica própria, Consultório alugado, E-commerce)" },
              team_size: { type: ["string", "null"] },
              revenue_range: { type: ["string", "null"], description: "Faixa de faturamento mensal mencionada" },
              ticket_range: { type: ["string", "null"], description: "Ticket médio que o lead pratica com clientes" },
              decision_role: { type: ["string", "null"] },
              main_pains: { type: "array", items: { type: "string" } },
              main_objections: { type: "array", items: { type: "string" } },
              triggers_that_worked: { type: "array", items: { type: "string" } },
              city: { type: ["string", "null"] },
              state: { type: ["string", "null"] },
              age_estimate: { type: ["string", "null"] },
            },
            required: ["profession", "specialty", "niche_combined", "main_pains", "main_objections"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "save_icp_signals" } },
    });
    if (icpResp.ok) {
      const icpData = await icpResp.json();
      const argsStr = icpData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (argsStr) icp_signals = JSON.parse(argsStr);
    } else {
      console.warn("ICP extraction non-ok:", icpResp.status);
    }
  } catch (e) {
    console.warn("ICP extraction failed (ignored):", e);
  }

  return { analysis, icp_signals };
}
