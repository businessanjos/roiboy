const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const body = await req.json();
    const {
      candidate_name = "",
      position_title = "",
      seniority = "",
      work_model = "",
      department = "",
      salary_amount = "",
      salary_currency = "BRL",
      benefits = [],
      perks = [],
      unit = "",
      reports_to = "",
    } = body;

    const prompt = `Você é um copywriter sênior de RH escrevendo uma carta-proposta da Eternum (ecossistema de mentoria, tecnologia e gestão para escalar negócios no Brasil).

Gere o conteúdo de uma proposta para:
- Candidato: ${candidate_name || "(não informado)"}
- Cargo: ${position_title}
- Senioridade: ${seniority}
- Departamento: ${department}
- Modelo: ${work_model}
- Unidade: ${unit}
- Reporta-se a: ${reports_to}
- Salário: ${salary_amount ? `${salary_currency} ${salary_amount}` : "(não informado)"}
- Benefícios selecionados: ${(benefits || []).join(", ") || "—"}
- Perks: ${(perks || []).map((p: any) => p.title).filter(Boolean).join(", ") || "—"}

Retorne JSON estrito com:
- hero_headline: frase curta e impactante de capa, mencionando o primeiro nome do candidato quando houver (máx 90 caracteres)
- company_intro: 2 parágrafos sobre a Eternum, tom inspirador, propósito + cultura (até 600 caracteres total)
- role_pitch: 3 parágrafos sobre por que o papel é estratégico, o que a pessoa vai fazer, como o sucesso será medido (até 900 caracteres)
- next_steps: parágrafo curto explicando aceitar a oferta clicando no botão final, com tom acolhedor (até 350 caracteres)
- signer_name: "Marina Quintana"
- signer_role: "Head de Pessoas"`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você responde APENAS com JSON válido, sem markdown, sem comentários." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições. Tente em alguns minutos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (res.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos na workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("AI error", res.status, txt);
      return new Response(JSON.stringify({ error: "Falha na IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
