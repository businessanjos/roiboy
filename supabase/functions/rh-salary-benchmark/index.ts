// Benchmark salarial via Perplexity (IA + busca web) para vagas do RH.
// Retorna faixa de mercado (P25/P50/P75), benefícios típicos e fontes citadas.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");

const CONTRACT_LABEL: Record<string, string> = {
  clt: "CLT",
  pj: "PJ",
  internship: "Estágio",
  temporary: "Temporário",
  freelancer: "Freelancer",
};
const SENIORITY_LABEL: Record<string, string> = {
  intern: "Estagiário",
  junior: "Júnior",
  pleno: "Pleno",
  senior: "Sênior",
  specialist: "Especialista",
  lead: "Tech Lead",
  manager: "Gerente",
  director: "Diretor",
};
const WORK_MODEL_LABEL: Record<string, string> = {
  remote: "Remoto",
  hybrid: "Híbrido",
  onsite: "Presencial",
};

const SYSTEM_PROMPT = `Você é um analista sênior de remuneração e benchmark salarial no Brasil. Sempre responda em PT-BR consultando fontes reais (Glassdoor, Love Mondays, Vagas.com, Catho, InfoJobs, LinkedIn Jobs, Gupy, Robert Half Guide, Michael Page, pesquisas Catho/Fipe/Fenacon). NUNCA invente números, empresas ou fatos — se não houver fonte confiável, retorne null/[] e explique em "notes".

Devolva EXCLUSIVAMENTE um objeto JSON válido (sem prosa antes/depois, sem markdown, sem \`\`\`) no formato:
{
  "headline": "1 frase objetiva com a faixa mediana e cidade/regime",
  "currency": "BRL",
  "market_range": { "p25": number|null, "p50": number|null, "p75": number|null },
  "period": "mensal" | "hora" | "anual",
  "sample_note": "curta explicação da amostra (ex.: 'baseado em ~340 salários reportados em SP nos últimos 12 meses')",
  "typical_benefits": ["Benefício 1", "Benefício 2", "..."],
  "missing_benefits": ["Benefícios comuns no mercado que a vaga NÃO oferece"],
  "extra_benefits": ["Benefícios que a vaga oferece e são acima da média"],
  "notes": "2-4 linhas de contexto: fatores que puxam a faixa, variação regional, riscos",
  "local_competitors": {
    "barueri": {
      "summary": "1-2 frases sobre como empresas em Barueri estão pagando/oferecendo para o cargo/nível",
      "salary_range": { "min": number|null, "max": number|null },
      "companies": [
        { "name": "Nome da empresa", "role_title": "título da vaga anunciada", "salary_min": number|null, "salary_max": number|null, "benefits": ["VR","VT","..."], "work_model": "remoto|híbrido|presencial|null", "source_title": "nome curto da fonte", "source_url": "https://..." }
      ]
    },
    "sao_paulo": {
      "summary": "1-2 frases sobre como empresas em São Paulo (capital) estão pagando/oferecendo para o cargo/nível",
      "salary_range": { "min": number|null, "max": number|null },
      "companies": [
        { "name": "...", "role_title": "...", "salary_min": number|null, "salary_max": number|null, "benefits": ["..."], "work_model": "...", "source_title": "...", "source_url": "https://..." }
      ]
    }
  },
  "sources": [{ "title": "Nome curto da fonte", "url": "https://..." }]
}

Regras: valores em REAIS mensais brutos (a menos que o contrato seja PJ/Estágio/Freelancer — mantenha bruto e explique em notes). Se o cargo/nível/cidade não tiver dados suficientes, retorne market_range com nulls e explique em notes. Preencha typical_benefits com o que é padrão no Brasil para o cargo/nível. Para local_competitors, liste 3 a 6 empresas REAIS por cidade com vaga do mesmo cargo/senioridade (ou o mais próximo possível), cada uma com URL de anúncio/página real. NUNCA inclua: (a) empresas anônimas/confidenciais/"não identificadas"/"empresa confidencial"; (b) empresas de segmentos incompatíveis com o cargo (ex.: sex shop, conteúdo adulto, ou qualquer nicho fora do escopo profissional da vaga); (c) anúncios em que não seja possível identificar o nome real da empresa. Se não achar dados qualificados para uma cidade, devolva companies: [] e explique no summary. Cite entre 2 e 5 fontes URLs reais no array sources.`;


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "PERPLEXITY_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const title: string = (body?.title || "").toString().trim();
    if (!title || title.length < 2) {
      return new Response(
        JSON.stringify({ error: "Título do cargo é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const seniority = body?.seniority ? SENIORITY_LABEL[body.seniority] || body.seniority : null;
    const contract = body?.contract_type ? CONTRACT_LABEL[body.contract_type] || body.contract_type : "CLT";
    const workModel = body?.work_model ? WORK_MODEL_LABEL[body.work_model] || body.work_model : null;
    const city = body?.city ? String(body.city).trim() : null;
    const state = body?.state ? String(body.state).trim() : null;
    const department = body?.department ? String(body.department).trim() : null;
    const offeredBenefits: string[] = Array.isArray(body?.benefits) ? body.benefits.filter(Boolean) : [];
    const salaryMin: number | null = typeof body?.salary_min === "number" ? body.salary_min : null;
    const salaryMax: number | null = typeof body?.salary_max === "number" ? body.salary_max : null;

    const locationText = city && state ? `${city}/${state}` : state || "Brasil";
    const parts = [
      `Cargo: ${title}`,
      seniority ? `Nível: ${seniority}` : null,
      `Regime: ${contract}`,
      workModel ? `Modelo de trabalho: ${workModel}` : null,
      `Localização: ${locationText}`,
      department ? `Área/Depto: ${department}` : null,
      offeredBenefits.length > 0 ? `Benefícios oferecidos pela empresa: ${offeredBenefits.join(", ")}` : "Benefícios oferecidos: (não informado)",
      salaryMin || salaryMax
        ? `Faixa que a empresa pretende oferecer: R$ ${salaryMin ?? "?"} a R$ ${salaryMax ?? "?"} (para você validar contra o mercado)`
        : null,
    ].filter(Boolean);

    const userPrompt = `Faça um benchmark de mercado para a vaga abaixo e devolva o JSON conforme instruído.\n\n${parts.join("\n")}\n\nAlém do benchmark geral, preencha OBRIGATORIAMENTE local_competitors com dados de empresas em Barueri/SP e São Paulo/SP contratando para o mesmo cargo/senioridade (ou o mais próximo). Cada empresa deve ter URL real de anúncio (Gupy, LinkedIn, Vagas.com, Catho, Glassdoor, InfoJobs, site da empresa). Sem inventar dados.`;

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        search_recency_filter: "year",
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("Perplexity error", res.status, txt);
      if (res.status === 401 && txt.includes("insufficient_quota")) {
        return new Response(
          JSON.stringify({
            error:
              "Créditos da API Perplexity esgotados. Compre créditos em https://console.perplexity.ai (créditos de API são separados da assinatura Pro).",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: `Perplexity ${res.status}: ${txt.slice(0, 300)}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const rawCitations: any[] = data?.citations || data?.search_results || [];
    const citations = rawCitations
      .map((c: any, i: number) => {
        if (typeof c === "string") return { index: i + 1, url: c, title: null };
        return {
          index: i + 1,
          url: c?.url || c?.link || null,
          title: c?.title || c?.name || null,
        };
      })
      .filter((c) => c.url);

    // Extrai o primeiro bloco JSON válido
    let parsed: any = null;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error("Failed to parse JSON from Perplexity", e, raw.slice(0, 300));
      }
    }

    if (!parsed) {
      return new Response(
        JSON.stringify({ error: "Resposta da IA não pôde ser interpretada. Tente novamente.", raw: raw.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Merge fontes: prefere as citations da Perplexity se o JSON não trouxer
    if ((!parsed.sources || parsed.sources.length === 0) && citations.length > 0) {
      parsed.sources = citations.map((c) => ({ title: c.title || c.url, url: c.url }));
    }

    return new Response(
      JSON.stringify({ success: true, benchmark: parsed, citations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("rh-salary-benchmark error", e);
    return new Response(
      JSON.stringify({ error: e?.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
