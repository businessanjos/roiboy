// Sales Dashboard Chat: Gemini Pro analisa dados, GPT gera insight.
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
}

async function buildSalesSnapshot(admin: ReturnType<typeof createClient>, accountId: string) {
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const sinceIso = since.toISOString();

  const [dealsR, stagesR, usersR, lossR, goalsR, pipelinesR] = await Promise.all([
    admin
      .from("deals")
      .select(
        "id,title,value,received_value,status,stage_id,pipeline_id,source,responsible_user_id,sdr_user_id,won_at,lost_at,lost_reason,loss_reason_id,created_at,expected_close_date",
      )
      .gte("created_at", sinceIso)
      .eq("account_id", accountId)
      .limit(5000),
    admin.from("deal_stages").select("id,name,pipeline_id,order_index,is_won,is_lost").eq("account_id", accountId),
    admin.from("users").select("id,name,role,team_role_id,is_active").eq("account_id", accountId),
    admin.from("deal_loss_reasons").select("id,name").eq("account_id", accountId),
    admin.from("sales_goals").select("*").eq("account_id", accountId).gte("created_at", sinceIso).limit(500),
    admin.from("pipelines").select("id,name,type").eq("account_id", accountId),
  ]);

  return {
    period_start: sinceIso,
    period_end: new Date().toISOString(),
    counts: {
      deals: dealsR.data?.length ?? 0,
      users: usersR.data?.length ?? 0,
      pipelines: pipelinesR.data?.length ?? 0,
    },
    pipelines: pipelinesR.data ?? [],
    stages: stagesR.data ?? [],
    users: usersR.data ?? [],
    loss_reasons: lossR.data ?? [],
    sales_goals: goalsR.data ?? [],
    deals: dealsR.data ?? [],
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
  try {
    return JSON.parse(text);
  } catch {
    return { analysis: text, kpi: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7);

    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authUserId = claims.claims.sub;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userRow } = await admin.from("users").select("account_id,name").eq("auth_user_id", authUserId).maybeSingle();
    if (!userRow?.account_id) {
      return new Response(JSON.stringify({ error: "User has no account" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as ReqBody;
    if (!body.question?.trim()) {
      return new Response(JSON.stringify({ error: "question required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) snapshot
    const snapshot = await buildSalesSnapshot(admin, userRow.account_id);

    // 2) Gemini Pro: Analista
    const analystSystem = `Você é um analista de dados sênior de operação comercial.
Receberá um snapshot JSON com deals, stages, users, motivos de perda, metas e pipelines dos últimos 12 meses.
Sua tarefa: responder à pergunta do gestor PURAMENTE em JSON com este shape:
{
  "analysis": "string com análise factual baseada nos dados (sem opiniões/recomendações)",
  "kpi": null OU { "label": "string curta", "value": número, "value_text": "string formatada (ex 'R$ 12.345')", "unit": "BRL|%|qtd|dias|null", "period": "string descritiva", "comparison": "string opcional vs período anterior", "trend": "up|down|flat" },
  "chart_hint": null OU { "type": "bar|line|pie", "data": [{"label":"x","value":n}] }
}
Use o KPI APENAS quando a pergunta produzir um número rastreável que faria sentido fixar no dashboard. Caso contrário, kpi=null.
Calcule você mesmo a partir do snapshot. Nunca invente dados.`;

    const analyst = await callJson("google/gemini-2.5-pro", [
      { role: "system", content: analystSystem },
      {
        role: "user",
        content: `Pergunta do gestor: ${body.question}\n\nSnapshot (JSON):\n${JSON.stringify(snapshot).slice(0, 180000)}`,
      },
    ]);

    // 3) GPT: Insight final (streaming)
    const insightSystem = `Você é um copiloto de gestão comercial. Receberá:
- a pergunta original do gestor
- a análise factual do analista (JSON)
Sua tarefa: gerar a resposta FINAL em markdown, em português, com tom executivo, direto, sem repetir o JSON.
Estrutura: 1) Resposta direta em 1-2 linhas. 2) Contexto/breakdown com bullets ou tabela. 3) Recomendação prática (1-3 ações).
Nunca invente números além dos presentes no JSON. Se kpi != null, mencione esse número com destaque.`;

    const gptResp = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5",
        stream: true,
        messages: [
          { role: "system", content: insightSystem },
          ...(body.history ?? []).slice(-6),
          {
            role: "user",
            content: `Pergunta: ${body.question}\n\nAnálise (JSON):\n${JSON.stringify(analyst)}`,
          },
        ],
      }),
    });

    if (!gptResp.ok || !gptResp.body) {
      const t = await gptResp.text();
      if (gptResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Tente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (gptResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados na workspace de IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway error", detail: t }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          send(JSON.stringify({ type: "metadata", kpi: analyst.kpi ?? null, chart_hint: analyst.chart_hint ?? null, analysis: analyst.analysis ?? null, models: { analyst: "google/gemini-2.5-pro", insight: "openai/gpt-5" } }));
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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
