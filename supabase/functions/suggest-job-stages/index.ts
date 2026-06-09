import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface ReqBody {
  title: string;
  description?: string;
  seniority?: string;
  contract_type?: string;
  department?: string;
}

// Mapa de entrevistadores finais por área (Eternum)
const FINAL_INTERVIEWERS: Record<string, string> = {
  comercial: 'Everton e Maikol',
  vendas: 'Everton e Maikol',
  marketing: 'Bruna e Maikol',
  cs: 'Bruna e Maikol',
  'customer success': 'Bruna e Maikol',
  sucesso: 'Bruna e Maikol',
  financeiro: 'Bruna e Maikol',
  financas: 'Bruna e Maikol',
  rh: 'Bruna e Maikol',
  'recursos humanos': 'Bruna e Maikol',
};

function resolveFinalInterviewers(department?: string): string {
  if (!department) return 'Bruna e Maikol';
  const key = department
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  for (const k of Object.keys(FINAL_INTERVIEWERS)) {
    if (key.includes(k)) return FINAL_INTERVIEWERS[k];
  }
  return 'Bruna e Maikol';
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

    const finalInterviewers = resolveFinalInterviewers(body.department);

    const system = `Você é um especialista em recrutamento e seleção da Eternum. Monte um processo seletivo enxuto e eficaz (4 a 6 etapas) para a vaga informada.

Regras OBRIGATÓRIAS:
1. A última etapa deve ser "Entrevista Final" conduzida por: ${finalInterviewers}.
2. Etapas anteriores ficam com RH (triagem), Gestor da área (entrevista técnica/cultural) ou Técnico (teste prático), conforme fizer sentido.
3. Para cargos comerciais inclua um role-play / simulação de venda.
4. Para cargos de marketing inclua análise de portfólio ou teste prático criativo.
5. Para cargos de CS inclua um case de atendimento.
6. Para cargos financeiros inclua um teste técnico (Excel, conciliação, etc).
7. Para cargos de RH inclua um case de people/processo.
8. Cada etapa precisa de: nome claro, responsável (pessoa ou papel), o que fazer na prática, e se aplica teste/material.

Retorne APENAS JSON válido neste formato (sem markdown, sem comentários):
{
  "stages": [
    {
      "name": "string",
      "sla_days": number,
      "owner_role": "RH" | "Gestor" | "Técnico" | "C-Level",
      "owner_name": "string (nome real quando souber, ex: 'Everton e Maikol')",
      "evaluation_criteria": ["bullet curto 1", "bullet curto 2", "bullet curto 3"],
      "what_to_do": "descrição prática do que executar nesta etapa",
      "test_or_material": "string ou null (ex: 'Role-play de cold call', 'Case de churn', 'Teste de Excel intermediário')"
    }
  ]
}`;

    const user = `Cargo: ${body.title}
Senioridade: ${body.seniority || 'não informada'}
Contrato: ${body.contract_type || 'não informado'}
Departamento/Área: ${body.department || 'não informado'}
Entrevistadores finais desta área: ${finalInterviewers}
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

    return new Response(JSON.stringify({ stages: parsed.stages || [], final_interviewers: finalInterviewers }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
