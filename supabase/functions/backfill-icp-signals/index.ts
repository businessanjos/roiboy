// Backfills `icp_signals` on champion calls that don't have them yet.
// Uses transcript_preview + analysis as the source. Iterates one-by-one to
// avoid rate limits. Safe to re-run — only touches rows where icp_signals IS NULL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { account_id, only_champions = true, limit = 30 } = await req.json();
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
    const { data: rows, error } = await q;
    if (error) throw error;

    let processed = 0, ok = 0, skipped = 0, failed = 0;
    for (const row of (rows || [])) {
      processed++;
      const source = `${row.analysis || ""}\n\nTRECHO DA TRANSCRIÇÃO:\n${row.transcript_preview || ""}`.trim();
      if (source.length < 200) { skipped++; continue; }

      try {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            messages: [
              { role: "system", content: "Você extrai sinais de ICP de uma análise + trecho de transcrição de call de vendas. Retorne SEMPRE em português, conciso e factual. Quando não houver evidência, retorne null ou array vazio — NUNCA invente. Para 'niche_combined' SEMPRE construa profissão + área (ex: 'Médico que atua com emagrecimento', 'Biomédica que atua com harmonização facial') quando houver pelo menos uma pista de profissão E de área." },
              { role: "user", content: source.substring(0, 14000) },
            ],
            tools: [{
              type: "function",
              function: {
                name: "save_icp_signals",
                description: "Salva sinais de ICP extraídos da call.",
                parameters: {
                  type: "object",
                  properties: {
                    profession: { type: ["string", "null"] },
                    specialty: { type: ["string", "null"] },
                    niche_combined: { type: ["string", "null"] },
                    business_model: { type: ["string", "null"] },
                    team_size: { type: ["string", "null"] },
                    revenue_range: { type: ["string", "null"] },
                    ticket_range: { type: ["string", "null"] },
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
          }),
        });
        if (!r.ok) {
          if (r.status === 429) return new Response(JSON.stringify({ processed, ok, skipped, failed, error: "rate_limit" }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          if (r.status === 402) return new Response(JSON.stringify({ processed, ok, skipped, failed, error: "no_credits" }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          failed++; continue;
        }
        const j = await r.json();
        const argsStr = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (!argsStr) { failed++; continue; }
        const icp = JSON.parse(argsStr);
        const { error: upErr } = await supabase
          .from("sales_call_analyses")
          .update({ icp_signals: icp })
          .eq("id", row.id);
        if (upErr) { failed++; continue; }
        ok++;
      } catch (e) {
        console.error("backfill row failed:", row.id, e);
        failed++;
      }
    }

    return new Response(JSON.stringify({ processed, ok, skipped, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("backfill-icp-signals error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
