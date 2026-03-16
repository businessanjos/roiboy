import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
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

    const SALES_TEAM_NAMES = ["jonathan", "vanessa", "darlan", "george"];

    // Fetch team users
    const { data: allUsers } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("account_id", accountId);

    const teamUsers = (allUsers || []).filter((u: any) =>
      SALES_TEAM_NAMES.some((n) => u.name?.toLowerCase().includes(n))
    );

    // If individual scope, filter to just that member
    const targetUsers = scope === "individual" && memberName
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

    // Fetch deals this month per user
    const { data: dealsThisMonth } = await supabase
      .from("deals")
      .select("id, value, status, responsible_user_id, won_at, created_at, lead_id")
      .eq("account_id", accountId)
      .in("responsible_user_id", teamUserIds)
      .gte("created_at", firstDayThisMonth)
      .lte("created_at", lastDayThisMonth + "T23:59:59");

    // Fetch deals last month per user
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
      .select("id, assigned_to, status, due_date, completed_at, activity_type_id")
      .eq("account_id", accountId)
      .in("assigned_to", teamUserIds)
      .gte("due_date", firstDayThisMonth)
      .lte("due_date", lastDayThisMonth);

    // Fetch calls this month
    const { data: callsThisMonth } = await supabase
      .from("zapp_calls")
      .select("id, user_id, duration_seconds, status, created_at")
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

    // Build performance summary per user
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

      const totalDeals = userDeals.length;
      const wonCount = userWonDeals.length;
      const wonValue = userWonDeals.reduce((s: number, d: any) => s + (d.value || 0), 0);
      const lostDeals = userDeals.filter((d: any) => d.status === "lost").length;
      const conversionRate = totalDeals > 0 ? ((wonCount / totalDeals) * 100).toFixed(1) : "0";

      const wonCountLastMonth = userWonLastMonth.length;
      const wonValueLastMonth = userWonLastMonth.reduce((s: number, d: any) => s + (d.value || 0), 0);
      const totalDealsLastMonth = userDealsLastMonth.length;

      const completedTasks = userTasks.filter((t: any) => t.status === "completed" || t.completed_at).length;
      const totalTasks = userTasks.length;
      const completedCalls = userCalls.filter((c: any) => c.status === "completed").length;
      const totalCallDuration = userCalls.reduce((s: number, c: any) => s + (c.duration_seconds || 0), 0);

      const goalsStr = userGoals.map((g: any) => `Meta ${(g as any).goal_type}: ${g.goal_value}`).join(", ");

      summaries.push(
        `**${u.name}** (Cargo: ${cargo}):
- Negócios criados mês atual: ${totalDeals} (mês passado: ${totalDealsLastMonth})
- Negócios ganhos mês atual: ${wonCount} totalizando R$ ${wonValue.toLocaleString("pt-BR")} (mês passado: ${wonCountLastMonth}, R$ ${wonValueLastMonth.toLocaleString("pt-BR")})
- Negócios perdidos mês atual: ${lostDeals}
- Taxa de conversão: ${conversionRate}%
- Tarefas concluídas: ${completedTasks}/${totalTasks}
- Ligações completadas: ${completedCalls} (duração total: ${Math.round(totalCallDuration / 60)} min)
- Metas: ${goalsStr || "Sem metas definidas"}`
      );
    }

    const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    const isIndividual = scope === "individual" && memberName;

    const systemPrompt = isIndividual
      ? `Você é um analista de performance comercial sênior. Analise os dados individuais de ${memberName} e gere insights acionáveis e personalizados.

REGRAS:
- Responda APENAS em português brasileiro
- Gere entre 4 e 6 insights focados exclusivamente neste vendedor
- Cada insight deve ter: um título curto (máx 8 palavras), uma descrição detalhada (2-3 frases), uma categoria (performance | comportamento | oportunidade | alerta), e um nível de prioridade (alta | média | baixa)
- Compare com o mês anterior quando relevante
- Seja específico: aponte pontos fortes, fraquezas, oportunidades de melhoria e riscos
- Sugira ações concretas quando possível
- Não invente dados que não foram fornecidos`
      : `Você é um analista de performance comercial sênior. Analise os dados da equipe de vendas e gere insights acionáveis.

REGRAS:
- Responda APENAS em português brasileiro
- Gere entre 4 e 8 insights
- Cada insight deve ter: um título curto (máx 8 palavras), uma descrição detalhada (2-3 frases), uma categoria (performance | comportamento | oportunidade | alerta), e um nível de prioridade (alta | média | baixa)
- Compare com o mês anterior quando relevante
- Identifique padrões de comportamento (quem liga mais, quem fecha mais, quem tem melhor taxa de conversão)
- Compare performances entre os membros da equipe
- Destaque riscos e oportunidades
- Seja direto e específico, cite nomes e números
- Não invente dados que não foram fornecidos`;

    const userPrompt = `Dados ${isIndividual ? `individuais de ${memberName}` : "da equipe comercial"} para ${monthName}:

${summaries.join("\n\n")}

Dia atual do mês: ${now.getDate()}/${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()} (${Math.round((now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) * 100)}% do mês)

Gere insights sobre a performance ${isIndividual ? `individual de ${memberName}` : "e comportamento da equipe"}.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_insights",
              description: "Generate team performance insights",
              parameters: {
                type: "object",
                properties: {
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Título curto do insight" },
                        description: { type: "string", description: "Descrição detalhada" },
                        category: { type: "string", enum: ["performance", "comportamento", "oportunidade", "alerta"] },
                        priority: { type: "string", enum: ["alta", "média", "baixa"] },
                        related_member: { type: "string", description: "Nome do membro relacionado, se aplicável" },
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
        tool_choice: { type: "function", function: { name: "generate_insights" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      return new Response(JSON.stringify({ error: "Erro ao gerar insights" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let insights = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        insights = parsed.insights || [];
      } catch {
        console.error("Failed to parse AI response");
      }
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
