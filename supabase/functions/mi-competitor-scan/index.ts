import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ETERNUM_CONTEXT = `A Eternum Mentoring Club é um clube de mentoria premium para médicos e profissionais da estética avançada no Brasil (dermatologia, HOF, harmonização, procedimentos injetáveis). Produtos: Rykas, Conselho, Eternum, MVP. Ticket típico R$ 40k–R$ 200k. Persona: profissional já em operação querendo escalar clínica, autoridade e faturamento.`;

async function scrapeFirecrawl(url: string) {
  if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY não configurada");
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "summary"],
      onlyMainContent: true,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Firecrawl ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const payload = data.data ?? data;
  return {
    markdown: (payload.markdown as string) ?? "",
    summary: (payload.summary as string) ?? "",
    metadata: payload.metadata ?? {},
  };
}

async function analyzeWithAI(name: string, website: string, markdown: string, summary: string) {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
  const truncated = markdown.slice(0, 12000);
  const systemPrompt = `Você é um analista de inteligência competitiva sênior. Analise o concorrente abaixo do ponto de vista da Eternum Mentoring Club e retorne JSON estrito.\n\n=== CONTEXTO ETERNUM ===\n${ETERNUM_CONTEXT}`;
  const userPrompt = `Concorrente: ${name}\nSite: ${website}\n\nResumo do site (Firecrawl):\n${summary || "(sem summary)"}\n\nConteúdo bruto (markdown, truncado):\n${truncated}\n\nRetorne APENAS este JSON:\n{\n  "positioning": "1-2 frases descrevendo o posicionamento",\n  "target_audience": "quem eles buscam",\n  "offers": [{"name":"nome do produto/oferta","price":"preço se visível ou null","format":"formato (mentoria/curso/comunidade/evento)"}],\n  "price_range": "faixa de preço observada ou 'não divulgado'",\n  "strengths": ["3-5 pontos fortes"],\n  "weaknesses": ["3-5 pontos fracos"],\n  "threats_to_eternum": ["ameaças diretas ao nosso modelo, 2-4 itens"],\n  "opportunities_for_eternum": ["oportunidades que a Eternum pode explorar, 2-4 itens"],\n  "overlap_score": 0-100,\n  "urgency": "low|medium|high",\n  "tags": ["tags curtas: nicho, formato, região"]\n}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    return JSON.parse(cleaned);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { competitorId } = await req.json();
    if (!competitorId) throw new Error("competitorId obrigatório");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: comp, error: cErr } = await supabase
      .from("mi_competitors")
      .select("*")
      .eq("id", competitorId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!comp) throw new Error("Concorrente não encontrado");

    const website = comp.website.startsWith("http") ? comp.website : `https://${comp.website}`;
    const scrape = await scrapeFirecrawl(website);
    const analysis = await analyzeWithAI(comp.name, website, scrape.markdown, scrape.summary);

    const { data: snap, error: sErr } = await supabase
      .from("mi_competitor_snapshots")
      .insert({
        competitor_id: competitorId,
        account_id: comp.account_id,
        source_url: website,
        markdown: scrape.markdown.slice(0, 100000),
        summary: scrape.summary || null,
        ai_analysis: analysis,
      })
      .select()
      .single();
    if (sErr) throw sErr;

    await supabase
      .from("mi_competitors")
      .update({ last_scanned_at: new Date().toISOString() })
      .eq("id", competitorId);

    return new Response(JSON.stringify({ success: true, snapshot: snap }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("mi-competitor-scan", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
