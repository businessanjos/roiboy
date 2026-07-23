const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");

const SYSTEM = `Você é um pesquisador especialista em eventos do MERCADO DE ESTÉTICA AVANÇADA/MÉDICA (Brasil e mundo).
Retorne SOMENTE eventos reais (congressos, feiras, simpósios) do setor de estética avançada/médica: injetáveis, laser, harmonização (facial/orofacial), dermato estética, medicina estética, biomedicina estética, tecnologias (RF, ultrassom microfocado, criolipólise).
NÃO inclua eventos de beleza comum (salão, cabelo, barbearia, manicure, SPA relaxamento) nem de estética capilar isolada.
Se não tiver certeza de um evento, NÃO invente — omita.
Responda estritamente no JSON schema pedido, em português.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!PERPLEXITY_API_KEY) {
      return new Response(JSON.stringify({ error: "PERPLEXITY_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const query: string = (body?.query || "").toString().trim();
    const exclude: string[] = Array.isArray(body?.exclude) ? body.exclude.slice(0, 200) : [];

    const userPrompt = `${
      query ||
      "Liste os principais eventos, congressos e feiras do mercado de estética avançada/médica em 2026 (Brasil e mundo)."
    }

Já mapeados (NÃO repita, traga apenas eventos ADICIONAIS):
${exclude.map((e) => `- ${e}`).join("\n") || "(nenhum)"}

Traga entre 6 e 15 eventos adicionais reais.`;

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        search_recency_filter: "year",
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "events",
            schema: {
              type: "object",
              properties: {
                events: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      city: { type: "string" },
                      country: { type: "string", enum: ["BR", "INT"] },
                      region: { type: "string" },
                      month: {
                        type: "string",
                        enum: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"],
                      },
                      audience: { type: "string" },
                      scale: { type: "string", enum: ["Grande", "Médio", "Regional"] },
                      focus: { type: "array", items: { type: "string" } },
                      organizer: { type: "string" },
                      url: { type: "string" },
                      notes: { type: "string" },
                    },
                    required: ["name", "city", "country", "month", "audience", "scale", "focus"],
                  },
                },
              },
              required: ["events"],
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("Perplexity error", res.status, txt);
      if (res.status === 401 && txt.includes("insufficient_quota")) {
        return new Response(
          JSON.stringify({
            error:
              "Créditos da API Perplexity esgotados. Compre créditos em https://console.perplexity.ai.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: `Perplexity ${res.status}: ${txt.slice(0, 300)}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { events: [] };
    }
    const events = Array.isArray(parsed?.events) ? parsed.events : [];

    return new Response(JSON.stringify({ success: true, events }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("mi-events-discover error", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
