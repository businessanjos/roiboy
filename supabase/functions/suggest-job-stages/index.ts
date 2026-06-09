import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface ReqBody {
  title: string;
  description?: string;
  seniority?: string;
  contract_type?: string;
  department?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.title) {
      return new Response(JSON.stringify({ error: 'title required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY missing' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const system = `Você é um especialista em recrutamento e seleção. Dado um cargo, sugira 4 a 6 etapas de processo seletivo enxutas e eficazes.
Retorne APENAS JSON válido no formato:
{
  "stages": [
    { "name": "string", "sla_days": number, "owner_role": "RH"|"Gestor"|"Técnico"|"C-Level", "evaluation_criteria": ["bullet1","bullet2","bullet3"], "ai_focus": "string curta com o que a IA deve observar nesta etapa" }
  ]
}
Sem markdown, sem comentários, sem texto extra.`;

    const user = `Cargo: ${body.title}
Senioridade: ${body.seniority || 'não informada'}
Contrato: ${body.contract_type || 'não informado'}
Departamento: ${body.department || 'não informado'}
Descrição: ${body.description?.slice(0, 1500) || 'sem descrição'}`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        response_format: { type: 'json_object' },
      }),
    });

    if (resp.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (resp.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: 'ai_error', detail: t }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    return new Response(JSON.stringify({ stages: parsed.stages || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
