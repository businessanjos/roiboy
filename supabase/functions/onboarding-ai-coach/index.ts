import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

type Mode = "next_step" | "risk_analysis" | "welcome_message" | "summary";

const TOOL = {
  type: "function" as const,
  function: {
    name: "report_onboarding_insight",
    description: "Devolve recomendações operacionais para o onboarding do cliente.",
    parameters: {
      type: "object",
      properties: {
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium", "low"],
          description: "Urgência da próxima ação",
        },
        next_action: {
          type: "string",
          description: "Próximo passo concreto (1 frase, imperativo, em PT-BR).",
        },
        why: {
          type: "string",
          description: "Justificativa curta baseada nos dados (1-2 frases).",
        },
        risks: {
          type: "array",
          items: { type: "string" },
          description: "Lista de 0 a 3 riscos detectados (churn precoce, baixo engajamento, etc).",
        },
        suggested_message: {
          type: "string",
          description:
            "Mensagem de WhatsApp pronta para enviar ao cliente (PT-BR, tom acolhedor, no máx 4 linhas, com emoji moderado).",
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Confiança 0..1 nas recomendações.",
        },
      },
      required: ["priority", "next_action", "why", "risks", "suggested_message", "confidence"],
      additionalProperties: false,
    },
  },
};

function modePrompt(mode: Mode): string {
  switch (mode) {
    case "welcome_message":
      return "Foque em escrever uma MENSAGEM DE BOAS-VINDAS impecável para WhatsApp em `suggested_message`. As outras chaves devem refletir essa abordagem.";
    case "risk_analysis":
      return "Foque em DETECTAR RISCOS de churn precoce, abandono ou problemas operacionais. Liste em `risks` o que viu e oriente o `next_action` para mitigação.";
    case "summary":
      return "Faça um RESUMO executivo do estado do onboarding em `why` (3-4 frases). `next_action` traz a recomendação principal.";
    case "next_step":
    default:
      return "Determine o PRÓXIMO PASSO ÓBVIO para destravar o cliente nesta etapa. Seja específico e acionável.";
  }
}

async function buildContext(supa: any, clientId: string) {
  const { data: client } = await supa
    .from("clients")
    .select(`
      id, full_name, company_name, phone_e164, created_at, status,
      stage_id, onboarding_started_at, stage_changed_at,
      stage:client_stages(id, name, display_order, sla_hours, description)
    `)
    .eq("id", clientId)
    .maybeSingle();

  if (!client) throw new Error("Cliente não encontrado");

  const [{ data: products }, { data: followups }, { data: deals }, { data: checklist }, { data: progress }] =
    await Promise.all([
      supa.from("client_products").select("products(name, color)").eq("client_id", clientId),
      supa
        .from("client_followups")
        .select("note, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(10),
      supa
        .from("deals")
        .select("title, value, status, won_at")
        .eq("client_id", clientId)
        .eq("status", "won")
        .order("won_at", { ascending: false })
        .limit(2),
      client.stage_id
        ? supa
            .from("stage_checklist_items")
            .select("id, label, action_type, is_required")
            .eq("stage_id", client.stage_id)
            .order("display_order")
        : Promise.resolve({ data: [] }),
      supa
        .from("client_stage_checklist")
        .select("checklist_item_id, completed_at")
        .eq("client_id", clientId),
    ]);

  const completedIds = new Set((progress ?? []).filter((p: any) => p.completed_at).map((p: any) => p.checklist_item_id));
  const checklistWithStatus = (checklist ?? []).map((c: any) => ({
    label: c.label,
    required: c.is_required,
    done: completedIds.has(c.id),
  }));

  const daysInStage = client.stage_changed_at
    ? Math.floor((Date.now() - new Date(client.stage_changed_at).getTime()) / 86400000)
    : 0;
  const daysSinceWon = client.onboarding_started_at
    ? Math.floor((Date.now() - new Date(client.onboarding_started_at).getTime()) / 86400000)
    : 0;
  const slaHours = client.stage?.sla_hours;
  const slaStatus =
    slaHours == null
      ? "sem SLA"
      : daysInStage * 24 > slaHours
        ? `ATRASADO (${daysInStage * 24}h vs SLA ${slaHours}h)`
        : daysInStage * 24 > slaHours * 0.5
          ? `em risco (${daysInStage * 24}h vs SLA ${slaHours}h)`
          : `dentro do prazo (${daysInStage * 24}h vs SLA ${slaHours}h)`;

  return {
    cliente: {
      nome: client.full_name,
      empresa: client.company_name,
      produtos: (products ?? []).map((p: any) => p.products?.name).filter(Boolean),
      dias_no_onboarding: daysSinceWon,
    },
    etapa_atual: {
      nome: client.stage?.name ?? "Sem etapa",
      ordem: client.stage?.display_order,
      descricao: client.stage?.description,
      dias_parado: daysInStage,
      sla_status: slaStatus,
    },
    checklist_etapa_atual: checklistWithStatus,
    deal_ganho: deals?.[0]
      ? {
          titulo: deals[0].title,
          valor: deals[0].value,
          ganho_em: deals[0].won_at,
        }
      : null,
    followups_recentes: (followups ?? []).slice(0, 8).map((f: any) => ({
      data: f.created_at,
      nota: typeof f.note === "string" ? f.note.slice(0, 240) : null,
    })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { clientId, mode = "next_step", forceRefresh = false } = (await req.json()) as {
      clientId: string;
      mode?: Mode;
      forceRefresh?: boolean;
    };

    if (!clientId) {
      return new Response(JSON.stringify({ error: "clientId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Cache: se já houver sugestão recente (<24h) e for modo next_step, devolve direto
    if (!forceRefresh && mode === "next_step") {
      const { data: cached } = await supa
        .from("clients")
        .select("ai_next_step, ai_next_step_at")
        .eq("id", clientId)
        .maybeSingle();
      if (cached?.ai_next_step && cached.ai_next_step_at) {
        const ageHours = (Date.now() - new Date(cached.ai_next_step_at).getTime()) / 3600000;
        if (ageHours < 24) {
          try {
            return new Response(JSON.stringify({ ...JSON.parse(cached.ai_next_step), cached: true }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } catch (_e) {
            // cache corrompido, segue regenerando
          }
        }
      }
    }

    const ctx = await buildContext(supa, clientId);

    const systemPrompt = `Você é um Coach de Customer Success especialista em onboarding de mentorias high-ticket.
Seu trabalho é orientar o consultor de Operações com PRÓXIMOS PASSOS específicos, riscos e mensagens prontas.
Tom: direto, prático, em PT-BR, sem floreios. Use os dados disponíveis. Se faltar informação, prefira recomendar coletar do que inventar.
Sempre devolva via tool calling estruturado. ${modePrompt(mode)}`;

    const userPrompt = `Contexto do cliente:\n\n${JSON.stringify(ctx, null, 2)}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "report_onboarding_insight" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em alguns minutos." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(
        JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos em Configurações → Workspace → Uso." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Erro na IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("Resposta sem tool call:", JSON.stringify(aiJson));
      return new Response(JSON.stringify({ error: "IA não retornou estrutura esperada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const insight = JSON.parse(toolCall.function.arguments);

    // Cacheia apenas para o modo padrão
    if (mode === "next_step") {
      await supa
        .from("clients")
        .update({
          ai_next_step: JSON.stringify(insight),
          ai_next_step_at: new Date().toISOString(),
        })
        .eq("id", clientId);
    }

    return new Response(JSON.stringify({ ...insight, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("onboarding-ai-coach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
