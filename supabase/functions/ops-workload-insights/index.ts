import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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
    let parsed: { rows: Row[]; periodLabel: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return new Response(JSON.stringify({ error: 'JSON inválido no corpo da requisição' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { rows, periodLabel } = parsed;
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Sem dados' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: 'Você é um analista de operações sênior. Responda em PT-BR, conciso e específico.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em instantes.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA esgotados no workspace.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await aiRes.text();
      console.error('AI gateway error', aiRes.status, t);
      return new Response(JSON.stringify({ error: 'Erro no gateway de IA' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await aiRes.json();
    const content = data?.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ insights: content, totals, overallRespRate, overallCoverage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('ops-workload-insights error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
