import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  sector?: string | null;
  period?: string;
  metrics?: Record<string, unknown>;
  risk_samples?: { contact_name?: string | null; sent_at?: string; excerpt?: string }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    const samples = (body.risk_samples || []).slice(0, 30);
    if (samples.length === 0) {
      return new Response(JSON.stringify({ analysis: "Sem menções de risco para analisar no período." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = [
      `Área: ${body.sector || "todas"} | Período: ${body.period || "mês atual"}`,
      `Métricas: ${JSON.stringify(body.metrics ?? {})}`,
      "Mensagens de clientes sinalizadas por palavras de risco:",
      ...samples.map((s, i) => `${i + 1}. [${s.sent_at ?? ""}] ${s.contact_name ?? "sem nome"}: ${s.excerpt ?? ""}`),
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é analista de Customer Success de uma mentoria brasileira. Classifique as mensagens sinalizadas em: risco real de cancelamento/pausa, dúvida financeira (reembolso/estorno), insatisfação pontual ou falso positivo. Responda em português, com no máximo 12 linhas: 1) resumo do risco real, 2) lista dos casos críticos com nome e motivo, 3) 3 ações recomendadas para os gestores. Sem emojis e sem travessões longos.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos para continuar." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ error: `Falha na IA: ${txt.slice(0, 300)}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await res.json();
    const analysis = json?.choices?.[0]?.message?.content ?? "Sem retorno da IA.";
    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
