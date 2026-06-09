import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalizeWebsite(url?: string | null): string | null {
  if (!url) return null;
  const t = url.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function logoFromWebsite(website: string | null): string | null {
  if (!website) return null;
  try {
    const u = new URL(website);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=128`;
  } catch {
    return null;
  }
}

async function perplexityResearch(stakeholder: {
  name: string;
  website?: string | null;
  company?: string | null;
  role?: string | null;
}, projectCtx: { name: string; description?: string | null; status?: string | null }) {
  if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY não configurada");

  const who = stakeholder.company
    ? `${stakeholder.name} (empresa: ${stakeholder.company})`
    : stakeholder.name;
  const siteHint = stakeholder.website ? `Site oficial: ${stakeholder.website}.` : "";
  const roleHint = stakeholder.role ? `Atua como ${stakeholder.role} no projeto.` : "";

  const userPrompt = `Pesquise informações reais e atualizadas sobre o stakeholder "${who}". ${siteHint}

Contexto do projeto que vai utilizá-lo:
- Projeto: ${projectCtx.name}
- Descrição: ${projectCtx.description || "(sem descrição)"}
- Status: ${projectCtx.status || "—"}
${roleHint}

Responda em JSON estrito (sem markdown, sem comentários) com este schema:
{
  "summary": "2-4 frases em PT-BR sobre quem é, o que faz, posicionamento e diferenciais relevantes",
  "company": "nome da empresa/marca principal (se aplicável)",
  "title": "cargo atual mais relevante (se pessoa)",
  "website": "URL oficial",
  "linkedin_url": "URL completa do LinkedIn (ou null)",
  "instagram_url": "URL completa do Instagram (ou null)",
  "logo_url": "URL pública do logo (ou null)",
  "recommendations": "3-5 bullets em PT-BR (separados por \\n- ) sobre COMO usar este stakeholder neste projeto específico: que tipo de entrega pedir, quando envolvê-lo, riscos, pontos fortes"
}

Use null para campos desconhecidos. Não invente.`;

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: "Você é um analista de inteligência de mercado. Responde apenas JSON válido." },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_schema", json_schema: {
        name: "stakeholder_research",
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            company: { type: ["string", "null"] },
            title: { type: ["string", "null"] },
            website: { type: ["string", "null"] },
            linkedin_url: { type: ["string", "null"] },
            instagram_url: { type: ["string", "null"] },
            logo_url: { type: ["string", "null"] },
            recommendations: { type: "string" },
          },
          required: ["summary", "recommendations"],
        },
      } },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Perplexity ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "{}";
  const citations: string[] = data?.citations || [];
  let parsed: any = {};
  try { parsed = JSON.parse(content); } catch { parsed = { summary: content, recommendations: "" }; }
  return {
    ...parsed,
    sources: citations.map((url) => ({ url })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { stakeholderId } = await req.json();
    if (!stakeholderId) throw new Error("stakeholderId obrigatório");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: sh, error: shErr } = await supabase
      .from("marketing_project_stakeholders")
      .select("*, project:marketing_projects(id, name, description, status)")
      .eq("id", stakeholderId)
      .maybeSingle();
    if (shErr) throw shErr;
    if (!sh) throw new Error("Stakeholder não encontrado");

    const project = (sh as any).project || { name: "Projeto" };
    const website = normalizeWebsite(sh.website);

    const research = await perplexityResearch(
      {
        name: sh.name || (sh as any).company || "Stakeholder",
        website,
        company: sh.company,
        role: sh.role,
      },
      project,
    );

    const finalWebsite = normalizeWebsite(research.website) || website;
    const finalLogo = research.logo_url || logoFromWebsite(finalWebsite);

    const patch: Record<string, any> = {
      ai_summary: research.summary || null,
      ai_recommendations: research.recommendations || null,
      ai_sources: research.sources || null,
      ai_researched_at: new Date().toISOString(),
    };
    if (!sh.company && research.company) patch.company = research.company;
    if (!sh.title && research.title) patch.title = research.title;
    if (!sh.website && finalWebsite) patch.website = finalWebsite;
    if (!sh.linkedin_url && research.linkedin_url) patch.linkedin_url = research.linkedin_url;
    if (!sh.instagram_url && research.instagram_url) patch.instagram_url = research.instagram_url;
    if (!sh.logo_url && finalLogo) patch.logo_url = finalLogo;
    if (!sh.bio && research.summary) patch.bio = research.summary;

    const { error: upErr } = await supabase
      .from("marketing_project_stakeholders")
      .update(patch)
      .eq("id", stakeholderId);
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ ok: true, patch }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("research-stakeholder", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
