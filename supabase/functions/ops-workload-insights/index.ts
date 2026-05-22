import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface Row {
  user_id: string;
  name: string;
  email: string;
  active_clients: number;
  clients_who_messaged: number;
  clients_attended: number;
  inbound_msgs: number;
  outbound_msgs: number;
  conversations: number;
  avg_first_response_min: number;
  median_first_response_min: number;
  total_response_time_min: number;
  responded_inbound: number;
  total_inbound_with_window: number;
}

function fmtMin(m: number) {
  if (!m || m <= 0) return '—';
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r === 0 ? `${h}h` : `${h}h ${r}min`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const raw = await req.text();
    if (!raw) {
      return new Response(JSON.stringify({ error: 'Corpo da requisição vazio' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let parsed: { rows: Row[]; periodLabel: string; rpcParams?: any };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return new Response(JSON.stringify({ error: 'JSON inválido no corpo da requisição' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { rows, periodLabel, rpcParams } = parsed;
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Sem dados' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve period bounds from rpcParams
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date = now;
    if (rpcParams?.p_start && rpcParams?.p_end) {
      periodStart = new Date(rpcParams.p_start);
      periodEnd = new Date(rpcParams.p_end);
    } else {
      const days = Number(rpcParams?.p_days) || 7;
      periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }


    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

    // Totais para contexto agregado
    const totals = rows.reduce((a, r) => ({
      active: a.active + r.active_clients,
      called: a.called + r.clients_who_messaged,
      attended: a.attended + r.clients_attended,
      inbound: a.inbound + r.inbound_msgs,
      outbound: a.outbound + r.outbound_msgs,
      convs: a.convs + r.conversations,
      resp: a.resp + r.responded_inbound,
      totalIn: a.totalIn + r.total_inbound_with_window,
      totalRespTime: a.totalRespTime + (Number(r.total_response_time_min) || 0),
    }), { active: 0, called: 0, attended: 0, inbound: 0, outbound: 0, convs: 0, resp: 0, totalIn: 0, totalRespTime: 0 });

    const table = rows.map(r => {
      const respRate = r.total_inbound_with_window > 0
        ? Math.round((r.responded_inbound / r.total_inbound_with_window) * 100) : 0;
      const coverage = r.active_clients > 0
        ? Math.round((r.clients_attended / r.active_clients) * 100) : 0;
      return [
        r.name,
        `carteira ${r.active_clients}`,
        `chamaram ${r.clients_who_messaged}`,
        `atendidos ${r.clients_attended} (${coverage}% da carteira)`,
        `recebidas ${r.inbound_msgs}`,
        `enviadas ${r.outbound_msgs}`,
        `conversas ${r.conversations}`,
        `1ª resposta média ${fmtMin(r.avg_first_response_min)}`,
        `mediana ${fmtMin(r.median_first_response_min)}`,
        `tempo total respondendo ${fmtMin(r.total_response_time_min)}`,
        `taxa de resposta ${respRate}% (${r.responded_inbound}/${r.total_inbound_with_window})`,
      ].join(' | ');
    }).join('\n');

    const overallRespRate = totals.totalIn > 0 ? Math.round((totals.resp / totals.totalIn) * 100) : 0;
    const overallCoverage = totals.active > 0 ? Math.round((totals.attended / totals.active) * 100) : 0;

    // === Sample client inbound messages for thematic analysis ===
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const consultantIds = rows.map(r => r.user_id).filter(Boolean);
    let messagesSample = '';
    let sampleCount = 0;
    try {
      // 1) Clients owned by these consultants
      const { data: clientsData } = await admin
        .from('clients')
        .select('id')
        .in('responsible_user_id', consultantIds);
      const clientIds = (clientsData || []).map((c: any) => c.id);

      if (clientIds.length > 0) {
        // 2) Conversations of those clients
        const { data: convsData } = await admin
          .from('zapp_conversations')
          .select('id, client_id')
          .in('client_id', clientIds);
        const convIds = (convsData || []).map((c: any) => c.id);

        if (convIds.length > 0) {
          // 3) Inbound text messages in period (cap to keep tokens reasonable)
          const { data: msgs } = await admin
            .from('zapp_messages')
            .select('content, transcription, message_type, sender_name, created_at, zapp_conversation_id')
            .in('zapp_conversation_id', convIds)
            .eq('direction', 'inbound')
            .gte('created_at', periodStart.toISOString())
            .lte('created_at', periodEnd.toISOString())
            .order('created_at', { ascending: false })
            .limit(1200);

          const lines: string[] = [];
          for (const m of (msgs || [])) {
            const txt = (m.content || m.transcription || '').toString().trim();
            if (!txt) continue;
            // skip super short / non-meaningful
            if (txt.length < 4) continue;
            const clean = txt.replace(/\s+/g, ' ').slice(0, 220);
            lines.push(`- ${clean}`);
            if (lines.length >= 600) break;
          }
          sampleCount = lines.length;
          messagesSample = lines.join('\n');
        }
      }
    } catch (e) {
      console.error('message sampling error', e);
    }

    const themesBlock = sampleCount > 0
      ? `\n\nAMOSTRA DE MENSAGENS RECEBIDAS DOS CLIENTES (${sampleCount} mensagens, do mais recente para o mais antigo):\n${messagesSample}\n`
      : `\n\n[Sem amostra de mensagens disponível no período]\n`;



    const prompt = `Você é um analista de operações sênior. Analise a performance das consultoras de Operações no período: ${periodLabel}.

TOTAIS DO PERÍODO:
- Carteira ativa total: ${totals.active} clientes
- Clientes que iniciaram contato: ${totals.called}
- Clientes efetivamente atendidos (receberam msg da consultora): ${totals.attended} (${overallCoverage}% de cobertura da carteira)
- Mensagens recebidas: ${totals.inbound} | Enviadas: ${totals.outbound}
- Conversas no período: ${totals.convs}
- Taxa global de resposta (em até 12h): ${overallRespRate}% (${totals.resp}/${totals.totalIn})
- Tempo total acumulado em respostas: ${fmtMin(totals.totalRespTime)}

POR CONSULTORA (uma por linha):
${table}

Entregue uma análise EXECUTIVA em português, em markdown, com as seções abaixo. Seja específico citando nomes, números e percentuais. Nada genérico.

## Resumo Executivo
2-3 frases dizendo a saúde geral do atendimento.

## Destaques Positivos
Quem está performando bem e por quê (cite métricas concretas).

## Alertas e Preocupações
Riscos reais: carteiras superdimensionadas (>40), baixa cobertura, tempo de resposta alto, taxa de resposta baixa, clientes que chamaram mas não foram atendidos. Cite nomes.

## Tempo de Atendimento
Comparar média vs mediana por consultora (se mediana << média → outliers puxando). Quem responde mais rápido, quem é mais lento.

## Recomendações
3-5 ações práticas e acionáveis para a reunião.

Seja direto, sem floreios. Use bullets onde fizer sentido.`;

    const callModel = async (model: string): Promise<{ content: string | null; error: string | null }> => {
      try {
        const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'Você é um analista de operações sênior. Responda em PT-BR, conciso e específico.' },
              { role: 'user', content: prompt },
            ],
          }),
        });
        if (!r.ok) {
          const t = await r.text();
          console.error(`[${model}] gateway error`, r.status, t);
          if (r.status === 429) return { content: null, error: 'Limite de requisições atingido' };
          if (r.status === 402) return { content: null, error: 'Créditos de IA esgotados' };
          return { content: null, error: `Erro ${r.status}` };
        }
        const data = await r.json();
        return { content: data?.choices?.[0]?.message?.content || '', error: null };
      } catch (e) {
        console.error(`[${model}] exception`, e);
        return { content: null, error: e instanceof Error ? e.message : 'Erro desconhecido' };
      }
    };

    const GEMINI_MODEL = 'google/gemini-2.5-pro';
    const GPT_MODEL = 'openai/gpt-5-mini';
    const SYNTH_MODEL = 'google/gemini-2.5-flash';

    const [gemini, gpt] = await Promise.all([
      callModel(GEMINI_MODEL),
      callModel(GPT_MODEL),
    ]);

    if (!gemini.content && !gpt.content) {
      return new Response(
        JSON.stringify({ error: `Ambos modelos falharam. Gemini: ${gemini.error}. GPT: ${gpt.error}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Etapa 2: SÍNTESE — combina as duas análises em UM relatório unificado
    const synthesisPrompt = `Você é o editor-chefe que consolida análises de dois analistas seniores em UM relatório executivo final, em português, em markdown.

DADOS REAIS (fonte da verdade — sempre prevalece sobre os analistas):
Período: ${periodLabel}
- Carteira ativa total: ${totals.active} clientes
- Clientes que iniciaram contato: ${totals.called}
- Clientes efetivamente atendidos: ${totals.attended} (${overallCoverage}% de cobertura)
- Mensagens recebidas: ${totals.inbound} | enviadas: ${totals.outbound}
- Conversas: ${totals.convs}
- Taxa global de resposta (12h): ${overallRespRate}% (${totals.resp}/${totals.totalIn})
- Tempo total respondendo: ${fmtMin(totals.totalRespTime)}

POR CONSULTORA:
${table}

ANÁLISE A:
${gemini.content || '[Indisponível]'}

ANÁLISE B:
${gpt.content || '[Indisponível]'}

REGRAS DA SÍNTESE:
1. Combine pontos onde A e B concordam (alta confiança).
2. Onde discordarem, escolha a versão melhor fundamentada nos números reais e descarte a outra.
3. NUNCA escreva "Analista A", "Analista B", "ambos modelos", "Gemini", "GPT" — o resultado deve parecer escrito por UMA pessoa.
4. Não duplique informação. Texto fluido, direto, executivo.
5. Cite nomes próprios, percentuais e métricas concretas.
6. Se os analistas divergirem em números, use os números do bloco DADOS REAIS.

Estrutura obrigatória:
## Resumo Executivo
2-3 frases sobre a saúde geral do atendimento.
## Destaques Positivos
Quem performa bem e por quê (métricas concretas).
## Alertas e Preocupações
Riscos com nomes: carteiras >40, baixa cobertura, resposta lenta, clientes que chamaram e não foram atendidos.
## Tempo de Atendimento
Média vs mediana, mais rápidos e mais lentos.
## Recomendações
3-5 ações práticas e acionáveis para a reunião.`;

    const synthesizerModel = SYNTH_MODEL;
    let unifiedContent: string | null = null;
    let unifiedError: string | null = null;
    try {
      const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: synthesizerModel,
          messages: [
            { role: 'system', content: 'Você é um editor sênior. Consolida análises em um relatório único e fluido, sem mencionar múltiplas fontes.' },
            { role: 'user', content: synthesisPrompt },
          ],
        }),
      });
      if (!r.ok) {
        unifiedError = `Erro na síntese: ${r.status}`;
        console.error('synthesis error', r.status, await r.text());
      } else {
        const data = await r.json();
        unifiedContent = data?.choices?.[0]?.message?.content || '';
      }
    } catch (e) {
      unifiedError = e instanceof Error ? e.message : 'Erro desconhecido';
      console.error('synthesis exception', e);
    }

    // Fallback: se síntese falhou, usa o melhor draft disponível
    const finalContent = unifiedContent || gemini.content || gpt.content || '';

    // Persist report
    let reportId: string | null = null;
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

      let userId: string | null = null;
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || '', {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: u } = await userClient.auth.getUser();
        userId = u?.user?.id || null;
      }

      const { data: ins, error: insErr } = await admin
        .from('ops_workload_ai_reports')
        .insert({
          created_by: userId,
          period_label: periodLabel,
          rows_count: rows.length,
          totals: { ...totals, overallRespRate, overallCoverage },
          rows_snapshot: rows,
          gemini_content: gemini.content,
          gpt_content: gpt.content,
          gemini_error: gemini.error,
          gpt_error: gpt.error,
          models_used: {
            gemini: GEMINI_MODEL,
            gpt: GPT_MODEL,
            synthesizer: synthesizerModel,
            unified_content: finalContent,
            unified_error: unifiedError,
          },
        })
        .select('id')
        .single();
      if (insErr) console.error('persist report error', insErr);
      else reportId = ins?.id || null;
    } catch (e) {
      console.error('persist exception', e);
    }

    return new Response(
      JSON.stringify({
        reportId,
        content: finalContent,
        synthesisError: unifiedError,
        usedFallback: !unifiedContent,
        drafts: { gemini: gemini.content, gpt: gpt.content },
        draftErrors: { gemini: gemini.error, gpt: gpt.error },
        totals,
        overallRespRate,
        overallCoverage,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('ops-workload-insights error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
