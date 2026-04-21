import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAI(apiKey: string, model: string, messages: any[], tools?: any[], toolChoice?: any) {
  const body: any = { model, messages };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const resp = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const status = resp.status;
    const errText = await resp.text();
    console.error(`AI gateway error (${model}):`, status, errText);
    return { error: true, status, errText };
  }

  return { error: false, data: await resp.json() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body for scope
    let scope = "team";
    let memberName: string | null = null;
    try {
      const body = await req.json();
      scope = body.scope || "team";
      memberName = body.member_name || null;
    } catch {
      // no body = default team scope
    }

    // Get user from token
    const supabase = createClient(supabaseUrl, supabaseKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get account_id
    const { data: userData } = await supabase
      .from("users")
      .select("account_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!userData) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountId = userData.account_id;
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const lastDayThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

    const SALES_TEAM_NAMES = ["jonathan", "vanessa", "darlan", "george", "maikol"];

    // Fetch team users
    const { data: allUsers } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("account_id", accountId);

    const teamUsers = (allUsers || []).filter((u: any) =>
      SALES_TEAM_NAMES.some((n) => u.name?.toLowerCase().includes(n))
    );

    const isIndividual = scope === "individual" && memberName;

    // For individual scope, filter to just that member for data queries
    const targetUsers = isIndividual
      ? teamUsers.filter((u: any) => u.name?.toLowerCase().includes(memberName!.toLowerCase()))
      : teamUsers;

    const teamUserIds = targetUsers.map((u: any) => u.id);
    const allTeamUserIds = teamUsers.map((u: any) => u.id);

    if (teamUserIds.length === 0) {
      return new Response(JSON.stringify({ insights: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch careers (cargo info)
    const { data: careers } = await supabase
      .from("sales_team_careers")
      .select("user_id, cargo")
      .eq("account_id", accountId)
      .in("user_id", allTeamUserIds);

    const cargoMap: Record<string, string> = {};
    for (const c of careers || []) cargoMap[(c as any).user_id] = (c as any).cargo || "Closer";

    // Fetch deals this month
    const { data: dealsThisMonth } = await supabase
      .from("deals")
      .select("id, value, status, responsible_user_id, won_at, created_at, lead_id, lost_reason, stage_id")
      .eq("account_id", accountId)
      .in("responsible_user_id", teamUserIds)
      .gte("created_at", firstDayThisMonth)
      .lte("created_at", lastDayThisMonth + "T23:59:59");

    // Fetch deals last month
    const { data: dealsLastMonth } = await supabase
      .from("deals")
      .select("id, value, status, responsible_user_id, won_at, created_at")
      .eq("account_id", accountId)
      .in("responsible_user_id", teamUserIds)
      .gte("created_at", firstDayLastMonth)
      .lte("created_at", lastDayLastMonth + "T23:59:59");

    // Fetch won deals this month
    const { data: wonDealsThisMonth } = await supabase
      .from("deals")
      .select("id, value, responsible_user_id, won_at")
      .eq("account_id", accountId)
      .eq("status", "won")
      .in("responsible_user_id", teamUserIds)
      .gte("won_at", firstDayThisMonth)
      .lte("won_at", lastDayThisMonth + "T23:59:59");

    // Fetch won deals last month
    const { data: wonDealsLastMonth } = await supabase
      .from("deals")
      .select("id, value, responsible_user_id, won_at")
      .eq("account_id", accountId)
      .eq("status", "won")
      .in("responsible_user_id", teamUserIds)
      .gte("won_at", firstDayLastMonth)
      .lte("won_at", lastDayLastMonth + "T23:59:59");

    // Fetch tasks this month
    const { data: tasksThisMonth } = await supabase
      .from("internal_tasks")
      .select("id, assigned_to, status, due_date, completed_at, activity_type_id, title")
      .eq("account_id", accountId)
      .in("assigned_to", teamUserIds)
      .gte("due_date", firstDayThisMonth)
      .lte("due_date", lastDayThisMonth);

    // Fetch calls this month
    const { data: callsThisMonth } = await supabase
      .from("zapp_calls")
      .select("id, user_id, duration_seconds, status, created_at, outcome")
      .eq("account_id", accountId)
      .in("user_id", teamUserIds)
      .gte("created_at", firstDayThisMonth)
      .lte("created_at", lastDayThisMonth + "T23:59:59");

    // Fetch goals this month
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const { data: goalsData } = await supabase
      .from("sales_monthly_goals")
      .select("*")
      .eq("account_id", accountId)
      .eq("year_month", currentYearMonth)
      .in("user_id", teamUserIds);

    // Fetch deal activities this month for engagement analysis
    const { data: dealActivities } = await supabase
      .from("deal_activities")
      .select("id, deal_id, type, user_id, created_at")
      .eq("account_id", accountId)
      .in("user_id", teamUserIds)
      .gte("created_at", firstDayThisMonth)
      .lte("created_at", lastDayThisMonth + "T23:59:59");

    // Fetch activity types for richer task data
    const { data: activityTypes } = await supabase
      .from("activity_types")
      .select("id, name")
      .eq("account_id", accountId);

    const activityTypeMap: Record<string, string> = {};
    for (const at of activityTypes || []) activityTypeMap[(at as any).id] = (at as any).name;

    // Build detailed performance summary per user
    const summaries: string[] = [];

    for (const u of targetUsers) {
      const userId = u.id;
      const cargo = cargoMap[userId] || "Closer";
      const userDeals = (dealsThisMonth || []).filter((d: any) => d.responsible_user_id === userId);
      const userWonDeals = (wonDealsThisMonth || []).filter((d: any) => d.responsible_user_id === userId);
      const userWonLastMonth = (wonDealsLastMonth || []).filter((d: any) => d.responsible_user_id === userId);
      const userDealsLastMonth = (dealsLastMonth || []).filter((d: any) => d.responsible_user_id === userId);
      const userTasks = (tasksThisMonth || []).filter((t: any) => t.assigned_to === userId);
      const userCalls = (callsThisMonth || []).filter((c: any) => c.user_id === userId);
      const userGoals = (goalsData || []).filter((g: any) => g.user_id === userId);
      const userActivities = (dealActivities || []).filter((a: any) => a.user_id === userId);

      const totalDeals = userDeals.length;
      const wonCount = userWonDeals.length;
      const wonValue = userWonDeals.reduce((s: number, d: any) => s + (d.value || 0), 0);
      const lostDeals = userDeals.filter((d: any) => d.status === "lost").length;
      const openDeals = userDeals.filter((d: any) => d.status === "open").length;
      const conversionRate = totalDeals > 0 ? ((wonCount / totalDeals) * 100).toFixed(1) : "0";
      const avgDealValue = wonCount > 0 ? Math.round(wonValue / wonCount) : 0;

      const wonCountLastMonth = userWonLastMonth.length;
      const wonValueLastMonth = userWonLastMonth.reduce((s: number, d: any) => s + (d.value || 0), 0);
      const totalDealsLastMonth = userDealsLastMonth.length;

      const completedTasks = userTasks.filter((t: any) => t.status === "completed" || t.completed_at).length;
      const pendingTasks = userTasks.filter((t: any) => !t.completed_at && t.status !== "completed").length;
      const overdueTasks = userTasks.filter((t: any) => !t.completed_at && new Date(t.due_date) < now).length;
      const totalTasks = userTasks.length;

      // Task breakdown by activity type
      const tasksByType: Record<string, number> = {};
      for (const t of userTasks) {
        const typeName = activityTypeMap[(t as any).activity_type_id] || "Sem tipo";
        tasksByType[typeName] = (tasksByType[typeName] || 0) + 1;
      }
      const taskBreakdown = Object.entries(tasksByType).map(([k, v]) => `${k}: ${v}`).join(", ");

      const completedCalls = userCalls.filter((c: any) => c.status === "completed").length;
      const answeredCalls = userCalls.filter((c: any) => c.outcome === "answered" || (c.duration_seconds && c.duration_seconds > 0)).length;
      const totalCallDuration = userCalls.reduce((s: number, c: any) => s + (c.duration_seconds || 0), 0);
      const avgCallDuration = completedCalls > 0 ? Math.round(totalCallDuration / completedCalls) : 0;

      // Lost reasons
      const lostReasons: Record<string, number> = {};
      for (const d of userDeals.filter((d: any) => d.status === "lost")) {
        const reason = (d as any).lost_reason || "Sem motivo";
        lostReasons[reason] = (lostReasons[reason] || 0) + 1;
      }
      const lostReasonsStr = Object.entries(lostReasons).map(([k, v]) => `${k}: ${v}`).join(", ");

      const totalActivities = userActivities.length;
      const goalsStr = userGoals.map((g: any) => `Meta ${(g as any).goal_type}: ${g.goal_value}`).join(", ");

      summaries.push(
        `**${u.name}** (Cargo: ${cargo}):
NEGÓCIOS:
- Criados mês atual: ${totalDeals} (mês passado: ${totalDealsLastMonth})
- Ganhos mês atual: ${wonCount} totalizando R$ ${wonValue.toLocaleString("pt-BR")} (mês passado: ${wonCountLastMonth}, R$ ${wonValueLastMonth.toLocaleString("pt-BR")})
- Ticket médio: R$ ${avgDealValue.toLocaleString("pt-BR")}
- Perdidos mês atual: ${lostDeals}${lostReasonsStr ? ` (Motivos: ${lostReasonsStr})` : ""}
- Em aberto: ${openDeals}
- Taxa de conversão: ${conversionRate}%
TAREFAS:
- Total: ${totalTasks} | Concluídas: ${completedTasks} | Pendentes: ${pendingTasks} | Atrasadas: ${overdueTasks}
- Por tipo: ${taskBreakdown || "N/A"}
LIGAÇÕES:
- Total: ${userCalls.length} | Completadas: ${completedCalls} | Atendidas: ${answeredCalls}
- Duração total: ${Math.round(totalCallDuration / 60)} min | Média por chamada: ${Math.round(avgCallDuration / 60)} min
ATIVIDADES EM NEGÓCIOS: ${totalActivities}
METAS: ${goalsStr || "Sem metas definidas"}`
      );
    }

    const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const dayProgress = `${now.getDate()}/${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()} (${Math.round((now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) * 100)}% do mês)`;

    // ===== STEP 1: Gemini 2.5 Pro — Deep data analysis =====
    const analysisPrompt = isIndividual
      ? `Analise profundamente TODOS os dados de performance de ${memberName} para ${monthName}. 
Foque EXCLUSIVAMENTE em ${memberName}. NÃO mencione outros vendedores.

${summaries.join("\n\n")}

Dia atual do mês: ${dayProgress}

Produza uma análise detalhada cobrindo:
1. Performance de vendas: volume, valor, conversão, ticket médio, tendências vs mês anterior
2. Produtividade operacional: tarefas concluídas vs atrasadas, tipos de atividades priorizadas
3. Padrões de ligação: volume, taxa de atendimento, duração média
4. Aderência a metas: progresso proporcional ao dia do mês
5. Motivos de perda de negócios
6. Riscos identificados
7. Oportunidades de melhoria

IMPORTANTE: Sua análise deve ser EXCLUSIVAMENTE sobre ${memberName}. Não mencione nenhum outro membro da equipe.`
      : `Analise profundamente TODOS os dados de performance da equipe comercial para ${monthName}.

${summaries.join("\n\n")}

Dia atual do mês: ${dayProgress}

Produza uma análise detalhada cobrindo:
1. Comparativo de performance entre membros (vendas, conversão, ticket médio)
2. Ranking de produtividade (tarefas, ligações, atividades)
3. Padrões de comportamento (quem foca em ligações, quem foca em tarefas, etc.)
4. Aderência a metas por membro
5. Motivos de perda de negócios por membro
6. Dinâmica de equipe e equilíbrio de carga
7. Riscos identificados
8. Oportunidades de melhoria coletiva`;

    console.log(`[Step 1] Calling Gemini 2.5 Pro for ${isIndividual ? memberName : "team"} analysis...`);

    const analysisResult = await callAI(lovableKey, "google/gemini-2.5-pro", [
      {
        role: "system",
        content: "Você é um analista de dados comerciais sênior. Analise os dados fornecidos com profundidade e rigor analítico. Responda em português brasileiro. Seja quantitativo e específico.",
      },
      { role: "user", content: analysisPrompt },
    ]);

    if (analysisResult.error) {
      if (analysisResult.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (analysisResult.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro na análise de dados" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = analysisResult.data.choices?.[0]?.message?.content || "";
    console.log(`[Step 1] Analysis complete (${analysis.length} chars)`);

    // ===== STEP 2: GPT 5.2 — Generate structured insights =====
    const insightSystemPrompt = isIndividual
      ? `Você é um consultor de performance comercial. Com base na análise de dados fornecida, gere insights acionáveis e personalizados para ${memberName}.

REGRAS CRÍTICAS:
- Responda APENAS em português brasileiro
- Gere entre 4 e 6 insights
- TODOS os insights devem ser EXCLUSIVAMENTE sobre ${memberName}
- NÃO mencione nenhum outro vendedor ou membro da equipe nos insights
- O campo "related_member" deve SEMPRE ser "${memberName}"
- Cada insight deve ter: um título curto (máx 8 palavras), uma descrição detalhada (2-3 frases com números e dados), uma categoria, e uma prioridade
- Sugira ações concretas e específicas
- Base-se APENAS nos dados da análise, não invente números`
      : `Você é um consultor de performance comercial. Com base na análise de dados fornecida, gere insights acionáveis sobre a equipe.

REGRAS:
- Responda APENAS em português brasileiro
- Gere exatamente 10 insights
- Compare performances entre os membros
- Identifique padrões de comportamento
- Seja direto e específico, cite nomes e números
- Sugira ações concretas
- Base-se APENAS nos dados da análise, não invente números`;

    console.log(`[Step 2] Calling GPT 5.2 for insight generation...`);

    const insightsResult = await callAI(
      lovableKey,
      "openai/gpt-5.2",
      [
        { role: "system", content: insightSystemPrompt },
        { role: "user", content: `Análise de dados:\n\n${analysis}\n\nGere insights estruturados com base nesta análise.` },
      ],
      [
        {
          type: "function",
          function: {
            name: "generate_insights",
            description: "Generate structured performance insights",
            parameters: {
              type: "object",
              properties: {
                insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Título curto do insight (máx 8 palavras)" },
                      description: { type: "string", description: "Descrição detalhada com dados e ações" },
                      category: { type: "string", enum: ["performance", "comportamento", "oportunidade", "alerta"] },
                      priority: { type: "string", enum: ["alta", "média", "baixa"] },
                      related_member: { type: "string", description: "Nome do membro relacionado" },
                    },
                    required: ["title", "description", "category", "priority"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["insights"],
              additionalProperties: false,
            },
          },
        },
      ],
      { type: "function", function: { name: "generate_insights" } }
    );

    if (insightsResult.error) {
      if (insightsResult.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (insightsResult.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao gerar insights" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toolCall = insightsResult.data.choices?.[0]?.message?.tool_calls?.[0];
    let insights = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        insights = parsed.insights || [];
      } catch {
        console.error("Failed to parse GPT 5.2 response");
      }
    }

    // For individual scope, filter out any insights that mention other team members
    if (isIndividual && memberName) {
      const otherMembers = SALES_TEAM_NAMES.filter((n) => n.toLowerCase() !== memberName!.toLowerCase());
      insights = insights.filter((i: any) => {
        const text = `${i.title} ${i.description} ${i.related_member || ""}`.toLowerCase();
        return !otherMembers.some((om) => text.includes(om));
      });
    }

    const generatedAt = new Date().toISOString();

    // Save to history
    await supabase.from("team_insights_history").insert({
      account_id: accountId,
      scope: isIndividual ? "individual" : "team",
      member_name: isIndividual ? memberName : null,
      insights: insights,
      generated_at: generatedAt,
    });

    console.log(`[Done] Generated ${insights.length} insights for ${isIndividual ? memberName : "team"}`);

    return new Response(JSON.stringify({ insights, generated_at: generatedAt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("team-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
