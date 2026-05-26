// Backfills `icp_signals` on calls that don't have them yet.
// Uses gemini-2.5-flash (fast, accurate enough for extraction) with PARALLEL
// processing in batches of 5 to avoid edge-function timeouts.
// Safe to re-run — only touches rows where icp_signals IS NULL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ICP_TOOL = {
  type: "function" as const,
  function: {
    name: "save_icp_signals",
    description: "Salva sinais de ICP extraídos da call.",
    parameters: {
      type: "object",
      properties: {
        profession: { type: ["string", "null"], description: "Profissão principal (ex: Médico, Dentista, Biomédica, Empresário)" },
        specialty: { type: ["string", "null"], description: "Especialidade/área (ex: Emagrecimento, Harmonização facial)" },
        niche_combined: { type: ["string", "null"], description: "Profissão + área (ex: 'Médico que atua com emagrecimento')" },
        business_model: { type: ["string", "null"] },
        team_size: { type: ["string", "null"] },
        revenue_range: { type: ["string", "null"], description: "Faturamento mensal" },
        ticket_range: { type: ["string", "null"], description: "Ticket médio que o lead pratica" },
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
};

const SYSTEM = "Você extrai sinais de ICP de uma análise de call de vendas em português. Seja conciso e factual. Se não houver evidência, retorne null ou array vazio — NUNCA invente. Para 'niche_combined' SEMPRE construa 'profissão + área' quando houver pista de profissão E área (ex: 'Médico que atua com emagrecimento', 'Biomédica que atua com harmonização facial', 'Dentista que atua com ortodontia').";

async function extractOne(apiKey: string, source: string): Promise<Record<string, unknown> | null> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: source.substring(0, 14000) },
      ],
      tools: [ICP_TOOL],
      tool_choice: { type: "function", function: { name: "save_icp_signals" } },
    }),
  });
  if (!r.ok) {
    if (r.status === 429) throw new Error("rate_limit");
    if (r.status === 402) throw new Error("no_credits");
    const txt = await r.text();
    console.error("AI extract failed", r.status, txt.slice(0, 200));
    return null;
  }
  const j = await r.json();
  const argsStr = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!argsStr) return null;
  try { return JSON.parse(argsStr); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { account_id, only_champions = false, limit = 80, ids = null } = await req.json();
    if (!account_id) {
      return new Response(JSON.stringify({ error: "account_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let q = supabase
      .from("sales_call_analyses")
      .select("id, analysis, transcript_preview, call_outcome")
      .eq("account_id", account_id)
      .is("icp_signals", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (only_champions) q = q.eq("call_outcome", "success");
    if (Array.isArray(ids) && ids.length) q = q.in("id", ids);
    const { data: rows, error } = await q;
    if (error) throw error;

    let processed = 0, ok = 0, skipped = 0, failed = 0;
    let fatal: string | null = null;

    // Process in parallel batches of 5 to stay under edge timeout
    const BATCH = 5;
    const list = rows || [];
    for (let i = 0; i < list.length && !fatal; i += BATCH) {
      const chunk = list.slice(i, i + BATCH);
      await Promise.all(chunk.map(async (row) => {
        if (fatal) return;
        processed++;
        const source = `${row.analysis || ""}\n\nTRECHO DA TRANSCRIÇÃO:\n${row.transcript_preview || ""}`.trim();
        if (source.length < 200) { skipped++; return; }
        try {
          const icp = await extractOne(LOVABLE_API_KEY, source);
          if (!icp) { failed++; return; }
          const { error: upErr } = await supabase
            .from("sales_call_analyses")
            .update({ icp_signals: icp })
            .eq("id", row.id);
          if (upErr) { failed++; return; }
          ok++;
        } catch (e: any) {
          if (e?.message === "rate_limit" || e?.message === "no_credits") fatal = e.message;
          else { console.error("row failed", row.id, e); failed++; }
        }
      }));
    }

    if (fatal === "rate_limit") {
      return new Response(JSON.stringify({ processed, ok, skipped, failed, error: "Limite de requisições — tente novamente em alguns segundos.", retryable: true }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (fatal === "no_credits") {
      return new Response(JSON.stringify({ processed, ok, skipped, failed, error: "Créditos de IA esgotados." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Tell client whether there might be more rows to process
    const remaining = list.length === limit; // hit the cap — likely more pending

    return new Response(JSON.stringify({ processed, ok, skipped, failed, remaining }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("backfill-icp-signals error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
