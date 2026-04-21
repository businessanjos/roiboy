import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CONSULTANT_IDS = [
  "01391bfa-5120-4d43-aedd-93e024c78094",
  "e0017d78-21d4-413a-befc-5197df7ad666",
  "3f3b5466-4479-48f8-bfe4-d9c4281ddab8",
  "81da2302-4770-4fd1-9200-c2a8cb3325f3",
];

const CONSULTANT_NAMES: Record<string, string> = {
  "01391bfa-5120-4d43-aedd-93e024c78094": "Dayara Grecco",
  "e0017d78-21d4-413a-befc-5197df7ad666": "Andréia Barros",
  "3f3b5466-4479-48f8-bfe4-d9c4281ddab8": "Michele Santos",
  "81da2302-4770-4fd1-9200-c2a8cb3325f3": "Ana Sant'Anna",
};

const CANCEL_STATUSES = [
  "cancelled",
  "distrato_cancelamento",
  "distrato_demissao",
  "desistencia_7d",
  "dismissed",
  "dropout_7d",
];

function inferGender(name: string): string {
  const first = (name || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
  if (first.endsWith("a") || first.endsWith("ê") || first.endsWith("ne") || first.endsWith("ia") || first.endsWith("na")) return "F";
  if (first.endsWith("o") || first.endsWith("os") || first.endsWith("on") || first.endsWith("el") || first.endsWith("us")) return "M";
  return "N/I";
}

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age > 0 && age < 120 ? age : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch cancelled contracts with richer client data
    const { data: contracts, error: contractsError } = await supabase
      .from("client_contracts")
      .select(
        `id, client_id, value, status, cancellation_reason, cancellation_justification,
         cancelled_at, status_changed_at, start_date, end_date,
         client:clients(id, full_name, phone_e164, responsible_user_id, birth_date, city, state, business_segment, business_niche),
         product:products(name)`
      )
      .in("status", CANCEL_STATUSES)
      .is("parent_contract_id", null)
      .order("cancelled_at", { ascending: false });

    if (contractsError) throw contractsError;

    const filteredContracts = (contracts || []).filter((c: any) =>
      c.client?.responsible_user_id && CONSULTANT_IDS.includes(c.client.responsible_user_id)
    );

    if (filteredContracts.length === 0) {
      return new Response(
        JSON.stringify({ insights: "Nenhum contrato cancelado encontrado para as consultoras filtradas." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get client IDs and fetch conversations + messages
    const clientIds = [...new Set(filteredContracts.map((c: any) => c.client_id))];

    const { data: conversations } = await supabase
      .from("zapp_conversations")
      .select("id, client_id, contact_name")
      .in("client_id", clientIds)
      .eq("is_group", false);

    const conversationIds = (conversations || []).map((c: any) => c.id);
    const convClientMap: Record<string, string> = {};
    (conversations || []).forEach((c: any) => {
      convClientMap[c.id] = c.client_id;
    });

    let allMessages: any[] = [];
    if (conversationIds.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < conversationIds.length; i += batchSize) {
        const batch = conversationIds.slice(i, i + batchSize);
        const { data: msgs } = await supabase
          .from("zapp_messages")
          .select("zapp_conversation_id, content, direction, sent_at, message_type, transcription")
          .in("zapp_conversation_id", batch)
          .not("content", "is", null)
          .order("sent_at", { ascending: false })
          .limit(500);
        if (msgs) allMessages.push(...msgs);
      }
    }

    const messagesByClient: Record<string, any[]> = {};
    allMessages.forEach((m) => {
      const clientId = convClientMap[m.zapp_conversation_id];
      if (clientId) {
        if (!messagesByClient[clientId]) messagesByClient[clientId] = [];
        messagesByClient[clientId].push(m);
      }
    });

    // 3. Fetch followups
    const { data: followups } = await supabase
      .from("client_followups")
      .select("client_id, content, type, created_at, title")
      .in("client_id", clientIds)
      .order("created_at", { ascending: false })
      .limit(500);

    const followupsByClient: Record<string, any[]> = {};
    (followups || []).forEach((f: any) => {
      if (!followupsByClient[f.client_id]) followupsByClient[f.client_id] = [];
      followupsByClient[f.client_id].push(f);
    });

    // 4. Build enriched summaries per consultant
    const byConsultant: Record<string, any[]> = {};
    filteredContracts.forEach((c: any) => {
      const cid = c.client?.responsible_user_id;
      if (!byConsultant[cid]) byConsultant[cid] = [];
      byConsultant[cid].push(c);
    });

    const consultantSummaries = Object.entries(byConsultant).map(([cid, contracts]) => {
      const name = CONSULTANT_NAMES[cid] || "Desconhecida";
      const total = contracts.length;
      const totalValue = contracts.reduce((s: number, c: any) => s + (c.value || 0), 0);
      return `📌 ${name}: ${total} cancelamentos, R$ ${totalValue.toFixed(2)} perdido`;
    }).join("\n");

    // Build detailed client summaries (up to 30)
    const clientSummaries = filteredContracts.slice(0, 30).map((contract: any) => {
      const clientId = contract.client_id;
      const client = contract.client;
      const clientName = client?.full_name || "Desconhecido";
      const gender = inferGender(clientName);
      const age = calcAge(client?.birth_date);
      const consultantName = CONSULTANT_NAMES[client?.responsible_user_id] || "N/I";
      const msgs = (messagesByClient[clientId] || []).slice(0, 15);
      const fups = (followupsByClient[clientId] || []).slice(0, 5);

      const daysActive = contract.start_date && contract.cancelled_at
        ? Math.floor((new Date(contract.cancelled_at).getTime() - new Date(contract.start_date).getTime()) / 86400000)
        : null;

      const cancelHour = contract.cancelled_at ? new Date(contract.cancelled_at).getHours() : null;

      const messagesSummary = msgs
        .map((m: any) => {
          const text = (m.content || m.transcription || "").slice(0, 200);
          const hour = m.sent_at ? new Date(m.sent_at).getHours() + "h" : "";
          return `[${m.direction === "outgoing" ? "EQUIPE" : "CLIENTE"} ${hour}] ${text || "(mídia)"}`;
        })
        .join("\n");

      const followupSummary = fups
        .map((f: any) => `[${f.type}] ${(f.title || "")}: ${(f.content || "").slice(0, 150)}`)
        .join("\n");

      return `=== ${clientName} | Gênero: ${gender} | Idade: ${age || "N/I"} | Cidade: ${client?.city || "N/I"}/${client?.state || ""} | Segmento: ${client?.business_segment || client?.business_niche || "N/I"} ===
Consultora: ${consultantName} | Produto: ${contract.product?.name || "N/A"} | R$${contract.value}
Status: ${contract.status} | Motivo: ${contract.cancellation_reason || "N/I"} | Justificativa: ${(contract.cancellation_justification || "").slice(0, 200)}
Dias ativo: ${daysActive ?? "N/I"} | Hora cancelamento: ${cancelHour !== null ? cancelHour + "h" : "N/I"}
Início: ${contract.start_date || "N/I"} | Cancelamento: ${contract.cancelled_at || "N/I"}
Msgs:\n${messagesSummary || "(sem msgs)"}
Notas:\n${followupSummary || "(sem notas)"}`;
    });

    const totalCancelled = filteredContracts.length;
    const totalValue = filteredContracts.reduce((s: number, c: any) => s + (c.value || 0), 0);

    // Demographics summary
    const genders = filteredContracts.map((c: any) => inferGender(c.client?.full_name || ""));
    const femaleCount = genders.filter((g: string) => g === "F").length;
    const maleCount = genders.filter((g: string) => g === "M").length;
    const ages = filteredContracts.map((c: any) => calcAge(c.client?.birth_date)).filter((a: number | null) => a !== null) as number[];
    const avgAge = ages.length > 0 ? (ages.reduce((a: number, b: number) => a + b, 0) / ages.length).toFixed(0) : "N/I";

    const systemPrompt = `Você é um analista de retenção de clientes especializado em programas de consultoria/mentoria.
Analise os dados de clientes que cancelaram e forneça insights acionáveis COM NOMES DE CLIENTES E CONSULTORAS.
Seja direto, cite nomes, números e padrões específicos.

Responda em português brasileiro (pt-BR).

Estruture sua resposta em EXATAMENTE estas seções (use os emojis e títulos exatos):

🏆 **RANKING DE CONSULTORAS**
Quem tem mais cancelamentos? Quem tem menos? Compare valores perdidos e % de churn por consultora. Cite nomes e números exatos. Quem é a pior e a melhor? Seja direto.

👤 **PERFIL DO CLIENTE QUE CANCELA**
Qual o perfil demográfico? Homem ou mulher? Idade média? De qual cidade/estado? Qual segmento de negócio? Cite nomes de clientes como exemplos concretos.

🔍 **PADRÕES IDENTIFICADOS**
Liste os 3-5 padrões mais comuns que levaram ao cancelamento. Cite nomes dos clientes como exemplo em cada padrão.

⚠️ **SINAIS DE ALERTA PRÉ-CHURN**
Quais comportamentos/sinais nas conversas indicavam que o cliente ia cancelar? Cite mensagens reais e nomes.

🕐 **TIMING CRÍTICO**
Em que horário os cancelamentos acontecem? Qual dia da semana? Em que momento do ciclo de vida (quantos dias/meses ativos)? Quais clientes cancelaram mais rápido?

💬 **ANÁLISE DE SENTIMENTO**
Como estava o tom das conversas antes do cancelamento? Houve mudança perceptível? Cite exemplos com nomes.

📊 **ANÁLISE POR MOTIVO**
Cruzando os motivos registrados com as conversas reais, os motivos batem? O que está por trás? Cite casos específicos.

🎯 **RECOMENDAÇÕES PRÁTICAS**
5-7 ações concretas que a equipe pode implementar AGORA para reduzir o churn. Priorize por impacto.

📈 **SCORE DE PREVENIBILIDADE**
De 0 a 100, qual % desses cancelamentos poderiam ter sido evitados com ação proativa? Justifique com casos específicos.`;

    const userPrompt = `DADOS GERAIS:
- Total de cancelamentos: ${totalCancelled}
- Valor total perdido: R$ ${totalValue.toFixed(2)}
- Gênero: ${femaleCount} mulheres, ${maleCount} homens
- Idade média: ${avgAge} anos
- Idades encontradas: ${ages.join(", ")} anos

RANKING POR CONSULTORA:
${consultantSummaries}

DADOS DETALHADOS DOS CLIENTES (${clientSummaries.length} de ${totalCancelled}):
${clientSummaries.join("\n---\n")}

Analise esses dados e forneça insights profundos sobre os padrões de churn. CITE NOMES ESPECÍFICOS de clientes e consultoras em toda a análise.`;

    const payload = JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    console.log(`[analyze-churn] Sending to AI. Payload size: ${payload.length} bytes, clients: ${clientSummaries.length}`);

    let aiData: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const aiResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: payload,
        }
      );

      if (aiResponse.ok) {
        aiData = await aiResponse.json();
        break;
      }

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const errText = await aiResponse.text();
      console.error(`[analyze-churn] AI attempt ${attempt}/3 failed: ${aiResponse.status}`, errText.slice(0, 200));

      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      } else {
        throw new Error(`AI gateway error after 3 attempts: ${aiResponse.status}`);
      }
    }

    const insights = aiData?.choices?.[0]?.message?.content || "Não foi possível gerar insights.";

    // Calculate period range from cancelled_at dates
    const cancelDates = filteredContracts
      .map((c: any) => c.cancelled_at)
      .filter(Boolean)
      .map((d: string) => new Date(d).getTime())
      .sort((a: number, b: number) => a - b);

    const periodStart = cancelDates.length > 0 ? new Date(cancelDates[0]).toISOString() : null;
    const periodEnd = cancelDates.length > 0 ? new Date(cancelDates[cancelDates.length - 1]).toISOString() : null;

    return new Response(
      JSON.stringify({
        insights,
        meta: {
          contractsAnalyzed: totalCancelled,
          clientsWithMessages: Object.keys(messagesByClient).length,
          totalMessages: allMessages.length,
          totalValue,
          periodStart,
          periodEnd,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-churn-conversations error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
