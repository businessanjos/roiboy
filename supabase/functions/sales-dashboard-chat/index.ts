// Sales Dashboard Chat (AION): Gemini Pro analisa dados, GPT gera insight.
// Streaming SSE: text deltas + chunk final `event: metadata` com KPI.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ReqBody {
  question: string;
  session_id?: string | null;
  history?: { role: "user" | "assistant"; content: string }[];
  period_months?: number; // janela de análise (default 12)
}

async function buildSnapshot(admin: ReturnType<typeof createClient>, accountId: string, monthsBack: number) {
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);
  const sinceIso = since.toISOString();
  const sinceDate = sinceIso.slice(0, 10);

  const [
    dealsR, stagesR, usersR, lossR, goalsR, pipelinesR,
    contractsR, finEntriesR, finCatsR, hrCollabR, spiffsR, commR,
  ] = await Promise.all([
    admin
      .from("deals")
      .select("id,title,value,received_value,status,stage_id,pipeline_id,source,responsible_user_id,sdr_user_id,won_at,lost_at,lost_reason,loss_reason_id,created_at,expected_close_date,client_id")
      .gte("created_at", sinceIso).eq("account_id", accountId).limit(5000),
    admin.from("deal_stages").select("id,name,pipeline_id,order_index,is_won,is_lost").eq("account_id", accountId),
    admin.from("users").select("id,name,role,team_role_id,is_active").eq("account_id", accountId),
    admin.from("deal_loss_reasons").select("id,name").eq("account_id", accountId),
    admin.from("sales_goals").select("*").eq("account_id", accountId).gte("created_at", sinceIso).limit(500),
    admin.from("pipelines").select("id,name,type").eq("account_id", accountId),
    // Clientes novos via contratos no período (proxy de "novos clientes")
    admin.from("contracts").select("id,client_id,product_id,value,status,start_date,created_at").gte("created_at", sinceIso).eq("account_id", accountId).limit(5000),
    // Custos: lançamentos financeiros pagos no período (despesas)
    admin.from("financial_entries").select("id,amount,entry_type,status,due_date,payment_date,category_id,description").eq("account_id", accountId).eq("entry_type", "payable").gte("due_date", sinceDate).limit(10000),
    admin.from("financial_categories").select("id,name,dre_group,type").eq("account_id", accountId),
    // Folha (snapshot atual de salários por depto) — proxy mensal
    admin.from("hr_collaborators").select("id,full_name,department,hr_department_id,salary,status,hire_date,termination_date,employment_type").eq("account_id", accountId).neq("status", "inactive").limit(2000),
    // Spiffs & comissões pagos
    admin.from("spiff_spins").select("id,prize_amount,created_at,user_id").eq("account_id", accountId).gte("created_at", sinceIso).limit(2000),
    admin.from("commission_deal_entries").select("id,commission_amount,user_id,created_at,deal_id").eq("account_id", accountId).gte("created_at", sinceIso).limit(5000),
  ]);

  // Pré-agregar custos por DRE/categoria por mês (reduz tokens)
  const catMap = new Map<string, { name: string; dre_group: string | null }>(
    (finCatsR.data ?? []).map((c: any) => [c.id, { name: c.name, dre_group: c.dre_group }]),
  );
  const costByMonth: Record<string, Record<string, number>> = {};
  for (const e of (finEntriesR.data ?? []) as any[]) {
    const cat = e.category_id ? catMap.get(e.category_id) : null;
    const group = cat?.dre_group ?? "uncategorized";
    const month = (e.payment_date ?? e.due_date ?? "").slice(0, 7);
    if (!month) continue;
    costByMonth[month] ??= {};
    costByMonth[month][group] = (costByMonth[month][group] ?? 0) + Number(e.amount ?? 0);
  }

  // Folha mensal por departamento (somatório atual)
  const payrollByDept: Record<string, number> = {};
  for (const c of (hrCollabR.data ?? []) as any[]) {
    const dept = c.department || "sem_departamento";
    payrollByDept[dept] = (payrollByDept[dept] ?? 0) + Number(c.salary ?? 0);
  }

  // Novos clientes/mês via contratos
  const newClientsByMonth: Record<string, Set<string>> = {};
  for (const c of (contractsR.data ?? []) as any[]) {
    const m = (c.start_date ?? c.created_at ?? "").slice(0, 7);
    if (!m || !c.client_id) continue;
    newClientsByMonth[m] ??= new Set();
    newClientsByMonth[m].add(c.client_id);
  }
  const newClientsMonthly = Object.fromEntries(
    Object.entries(newClientsByMonth).map(([m, s]) => [m, s.size]),
  );

  // ===== Agregações de deals (evita mandar raw 5000 linhas) =====
  const stageMap = new Map<string, any>((stagesR.data ?? []).map((s: any) => [s.id, s]));
  const userMap = new Map<string, string>((usersR.data ?? []).map((u: any) => [u.id, u.name]));
  const lossMap = new Map<string, string>((lossR.data ?? []).map((l: any) => [l.id, l.name]));

  const dealsByMonth: Record<string, { created: number; won: number; lost: number; won_value: number; lost_value: number }> = {};
  const wonByOwner: Record<string, { name: string; won: number; value: number }> = {};
  const lostByReason: Record<string, { name: string; count: number; value: number }> = {};
  const dealsBySource: Record<string, number> = {};
  let totalCreated = 0, totalWon = 0, totalLost = 0, totalWonValue = 0, totalLostValue = 0, totalOpenValue = 0;

  for (const d of (dealsR.data ?? []) as any[]) {
    totalCreated++;
    const createdMonth = (d.created_at ?? "").slice(0, 7);
    if (createdMonth) {
      dealsByMonth[createdMonth] ??= { created: 0, won: 0, lost: 0, won_value: 0, lost_value: 0 };
      dealsByMonth[createdMonth].created++;
    }
    const val = Number(d.received_value ?? d.value ?? 0);
    const stage = d.stage_id ? stageMap.get(d.stage_id) : null;
    const isWon = d.status === "won" || stage?.is_won;
    const isLost = d.status === "lost" || stage?.is_lost;
    if (isWon) {
      totalWon++; totalWonValue += val;
      const wm = (d.won_at ?? d.created_at ?? "").slice(0, 7);
      if (wm) {
        dealsByMonth[wm] ??= { created: 0, won: 0, lost: 0, won_value: 0, lost_value: 0 };
        dealsByMonth[wm].won++; dealsByMonth[wm].won_value += val;
      }
      const oid = d.responsible_user_id ?? "unknown";
      wonByOwner[oid] ??= { name: userMap.get(oid) ?? "Desconhecido", won: 0, value: 0 };
      wonByOwner[oid].won++; wonByOwner[oid].value += val;
    } else if (isLost) {
      totalLost++; totalLostValue += val;
      const lm = (d.lost_at ?? d.created_at ?? "").slice(0, 7);
      if (lm) {
        dealsByMonth[lm] ??= { created: 0, won: 0, lost: 0, won_value: 0, lost_value: 0 };
        dealsByMonth[lm].lost++; dealsByMonth[lm].lost_value += val;
      }
      const rname = (d.loss_reason_id ? lossMap.get(d.loss_reason_id) : null) ?? d.lost_reason ?? "sem_motivo";
      lostByReason[rname] ??= { name: rname, count: 0, value: 0 };
      lostByReason[rname].count++; lostByReason[rname].value += val;
    } else {
      totalOpenValue += val;
    }
    const src = d.source ?? "sem_origem";
    dealsBySource[src] = (dealsBySource[src] ?? 0) + 1;
  }

  const commByUserMonth: Record<string, Record<string, number>> = {};
  for (const c of (commR.data ?? []) as any[]) {
    const uid = c.user_id ?? "unknown";
    const m = (c.created_at ?? "").slice(0, 7);
    if (!m) continue;
    commByUserMonth[uid] ??= {};
    commByUserMonth[uid][m] = (commByUserMonth[uid][m] ?? 0) + Number(c.commission_amount ?? 0);
  }
  const spiffByMonth: Record<string, number> = {};
  for (const s of (spiffsR.data ?? []) as any[]) {
    const m = (s.created_at ?? "").slice(0, 7);
    if (!m) continue;
    spiffByMonth[m] = (spiffByMonth[m] ?? 0) + Number(s.prize_amount ?? 0);
  }

  return {
    period: { months: monthsBack, start: sinceIso, end: new Date().toISOString() },
    counts: {
      deals: dealsR.data?.length ?? 0,
      contracts: contractsR.data?.length ?? 0,
      users: usersR.data?.length ?? 0,
      pipelines: pipelinesR.data?.length ?? 0,
      hr_collaborators: hrCollabR.data?.length ?? 0,
      financial_entries: finEntriesR.data?.length ?? 0,
    },
    pipelines: pipelinesR.data ?? [],
    stages: (stagesR.data ?? []).map((s: any) => ({ id: s.id, name: s.name, pipeline_id: s.pipeline_id, is_won: s.is_won, is_lost: s.is_lost })),
    users: (usersR.data ?? []).filter((u: any) => u.is_active).map((u: any) => ({ id: u.id, name: u.name, role: u.role })),
    loss_reasons: lossR.data ?? [],
    sales_goals: goalsR.data ?? [],
    deals_summary: {
      total_created: totalCreated,
      total_won: totalWon,
      total_lost: totalLost,
      total_won_value: totalWonValue,
      total_lost_value: totalLostValue,
      total_open_value: totalOpenValue,
      win_rate: totalWon + totalLost > 0 ? totalWon / (totalWon + totalLost) : null,
      avg_ticket_won: totalWon > 0 ? totalWonValue / totalWon : 0,
    },
    deals_by_month: dealsByMonth,
    won_by_owner: Object.values(wonByOwner).sort((a, b) => b.value - a.value).slice(0, 30),
    lost_by_reason: Object.values(lostByReason).sort((a, b) => b.count - a.count).slice(0, 30),
    deals_by_source: dealsBySource,
    cost_by_month_by_dre_group: costByMonth,
    payroll_current_by_department: payrollByDept,
    commissions_by_user_by_month: commByUserMonth,
    spiff_payouts_by_month: spiffByMonth,
    new_clients_per_month: newClientsMonthly,
    financial_categories: (finCatsR.data ?? []).map((c: any) => ({ id: c.id, name: c.name, dre_group: c.dre_group })),
  };
}

async function callJson(model: string, messages: any[]) {
  const r = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, response_format: { type: "json_object" } }),
  });
  if (!r.ok) throw new Error(`${model} ${r.status}: ${await r.text()}`);
  const json = await r.json();
  const text = json.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(text); } catch { return { analysis: text, kpi: null }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7);

    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authUserId = claims.claims.sub;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userRow } = await admin.from("users").select("account_id,name").eq("auth_user_id", authUserId).maybeSingle();
    if (!userRow?.account_id) {
      return new Response(JSON.stringify({ error: "User has no account" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as ReqBody;
    if (!body.question?.trim()) {
      return new Response(JSON.stringify({ error: "question required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const monthsBack = Math.max(1, Math.min(36, Number(body.period_months ?? 12)));
    const snapshot = await buildSnapshot(admin, userRow.account_id, monthsBack);

    const analystSystem = `Você é um analista de dados sênior de operação comercial e financeira.
Receberá um snapshot JSON com dados dos últimos ${monthsBack} meses contendo:
- deals, stages, pipelines, users, loss_reasons, sales_goals
- contracts (proxy de clientes adquiridos)
- cost_by_month_by_dre_group: despesas pagas/lançadas por mês e grupo DRE (sales, personnel, administrative, financial_expenses, taxes, etc.)
- payroll_current_by_department: folha mensal atual por departamento (snapshot, não série histórica)
- spiff_payouts e commission_entries: pagamentos variáveis por usuário/mês
- new_clients_per_month: contagem de clientes novos por mês (via contratos)
- financial_categories: dicionário de categorias (id -> name, dre_group)

CAC (Custo de Aquisição de Cliente):
  CAC_mensal = (custos_marketing + custos_vendas) / novos_clientes_do_mês
  - custos_marketing ≈ soma dos lançamentos cuja categoria tem nome contendo "marketing" OU dre_group="sales" referente a mídia/propaganda + folha do depto Marketing + ferramentas marketing
  - custos_vendas ≈ comissões + spiffs + folha do depto Comercial/Vendas + ferramentas comerciais
  - Use payroll_current_by_department como aproximação mensal da folha quando faltar lançamento explícito.
  - SEMPRE explicite quais componentes você incluiu e quais faltam. Se algum dado essencial faltar, calcule o que for possível e sinalize a aproximação no campo "analysis".

Responda PURAMENTE em JSON:
{
  "analysis": "string com análise factual + breakdown numérico + premissas usadas",
  "kpi": null OU { "label": "string curta", "value": número, "value_text": "string formatada (ex 'R$ 12.345')", "unit": "BRL|%|qtd|dias|null", "period": "string descritiva", "comparison": "string opcional vs período anterior", "trend": "up|down|flat" },
  "chart_hint": null OU { "type": "bar|line|pie", "data": [{"label":"x","value":n}] }
}
Use kpi APENAS quando a pergunta produzir um número rastreável fixável no dashboard. Caso contrário, kpi=null.
NUNCA invente dados. Se faltar algo crítico, calcule o melhor possível e liste no analysis o que precisa ser preenchido (ex: "Folha do depto Marketing não cadastrada no RH").`;

    const analyst = await callJson("google/gemini-2.5-pro", [
      { role: "system", content: analystSystem },
      { role: "user", content: `Pergunta do gestor: ${body.question}\n\nSnapshot (JSON):\n${JSON.stringify(snapshot).slice(0, 220000)}` },
    ]);

    const insightSystem = `Você é o AION, copiloto executivo de gestão comercial e financeira. Receberá:
- a pergunta original do gestor
- a análise factual do analista (JSON, com premissas e breakdown)
Sua tarefa: gerar a resposta FINAL em markdown, em português, com tom executivo, direto, sem repetir o JSON cru.
Estrutura obrigatória:
1) **Resposta direta** em 1-2 linhas com o número principal em destaque.
2) **Breakdown** com bullets ou pequena tabela mostrando os componentes do cálculo.
3) **Premissas e gaps**: se a análise menciona aproximações ou dados faltantes, liste-os em uma seção "⚠️ Premissas usadas" para o gestor saber a confiança da resposta.
4) **Recomendação** prática (1-3 ações concretas).
Nunca invente números além dos presentes no JSON. Se kpi != null, destaque esse número.`;

    const gptResp = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5",
        stream: true,
        messages: [
          { role: "system", content: insightSystem },
          ...(body.history ?? []).slice(-6),
          { role: "user", content: `Pergunta: ${body.question}\n\nAnálise (JSON):\n${JSON.stringify(analyst)}` },
        ],
      }),
    });

    if (!gptResp.ok || !gptResp.body) {
      const t = await gptResp.text();
      if (gptResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Tente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (gptResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados na workspace de IA." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway error", detail: t }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: string) => controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        const reader = gptResp.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let nl;
            while ((nl = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, nl);
              buffer = buffer.slice(nl + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (payload === "[DONE]") continue;
              try {
                const parsed = JSON.parse(payload);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) send(JSON.stringify({ type: "delta", content: delta }));
              } catch {
                buffer = line + "\n" + buffer;
                break;
              }
            }
          }
          send(JSON.stringify({ type: "metadata", kpi: analyst.kpi ?? null, chart_hint: analyst.chart_hint ?? null, analysis: analyst.analysis ?? null, period_months: monthsBack, models: { analyst: "google/gemini-2.5-pro", insight: "openai/gpt-5" } }));
          send("[DONE]");
        } catch (e) {
          send(JSON.stringify({ type: "error", error: String(e) }));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("sales-dashboard-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
