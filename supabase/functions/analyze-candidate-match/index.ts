import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { application_id } = await req.json();
    if (!application_id) return new Response(JSON.stringify({ error: 'application_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY missing' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: app, error: appErr } = await supabase
      .from('hr_job_applications')
      .select('*')
      .eq('id', application_id)
      .maybeSingle();
    if (appErr || !app) return new Response(JSON.stringify({ error: 'application not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: job } = await supabase
      .from('hr_jobs')
      .select('*')
      .eq('id', app.job_id)
      .maybeSingle();

    const { data: stages } = await supabase
      .from('hr_job_stages')
      .select('name, ai_focus, evaluation_criteria')
      .eq('job_id', app.job_id)
      .order('order_index');

    const system = `Você é um especialista em recrutamento. Analise o fit candidato↔vaga e devolva APENAS JSON válido:
{
  "match_score": 0-100,
  "verdict": "strong_match"|"possible"|"weak"|"reject",
  "strengths": ["..."],
  "gaps": ["..."],
  "red_flags": ["..."],
  "recommended_questions": ["..."],
  "stage_focus": [{ "stage": "nome", "focus": "o que investigar especificamente neste candidato nesta etapa" }],
  "summary": "1 parágrafo curto em português"
}
Sem markdown, sem citações, sem comentários.`;

    const userPayload = {
      vaga: {
        titulo: job?.title,
        senioridade: job?.seniority,
        descricao: job?.description?.slice(0, 3000),
        requisitos: job?.requirements?.slice(0, 1500),
        required_skills: job?.required_skills,
        desired_skills: job?.desired_skills,
        etapas: stages || [],
      },
      candidato: {
        nome: app.candidate_name,
        email: app.candidate_email,
        cidade: app.candidate_city,
        estado: app.candidate_state,
        cargo_desejado: app.desired_position,
        senioridade_desejada: app.desired_seniority,
        carta_apresentacao: app.cover_letter?.slice(0, 3000),
        curriculo_url: app.resume_url,
        profiler: app.profiler_result_code,
      },
    };

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
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
    let report: any = {};
    try { report = JSON.parse(content); } catch { report = {}; }

    const score = Math.max(0, Math.min(100, Math.round(Number(report.match_score) || 0)));

    await supabase
      .from('hr_job_applications')
      .update({
        ai_match_score: score,
        ai_match_report: report,
        ai_match_analyzed_at: new Date().toISOString(),
      })
      .eq('id', application_id);

    return new Response(JSON.stringify({ ok: true, score, report }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
