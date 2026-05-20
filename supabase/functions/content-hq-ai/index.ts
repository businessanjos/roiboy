import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-3-flash-preview';

const PLATFORM_TIPS: Record<string, string> = {
  instagram: 'Reels 7-15s, hook nos 2 primeiros segundos, legenda escaneável, CTA claro.',
  youtube: 'Vídeo longo: storytelling, retention curve, thumbnail + título com curiosidade. Shorts: 30-60s, loop.',
  tiktok: 'Trends, áudio nativo, hook visual imediato, formato vertical 9:16, sem marca d\'água.',
  threads: 'Texto direto, opinião forte, perguntas abertas pra engajar.',
  linkedin: 'Tom profissional-pessoal, autoridade, casos reais, parágrafos curtos.',
  pinterest: 'Pin vertical 1000x1500, título descritivo SEO, palavra-chave forte.',
  spotify: 'Episódio de podcast: gancho narrativo nos 30s iniciais, capítulos claros, CTA no final.',
};

function systemFor(talentName: string, niche: string, brandVoice?: string | null) {
  return [
    `Você é Head de Conteúdo da Eternum Mentoring Club, criando estratégia para ${talentName}.`,
    `CONTEXTO CRÍTICO DO NEGÓCIO: A Eternum vende MENTORIA para profissionais da área de estética (médicos, biomédicos, dentistas, donos de clínica). O público-alvo do conteúdo são COLEGAS profissionais — não pacientes.`,
    `Os temas SEMPRE giram em torno de: vendas, marketing, gestão de clínica, precificação (cobrar mais caro), atendimento de alto padrão, posicionamento de autoridade, mentalidade de empresário, liderança de equipe, captação de pacientes premium, jornada do paciente, branding pessoal do profissional.`,
    `NUNCA crie conteúdo educativo sobre procedimentos, técnicas clínicas, indicações de produtos, protocolos estéticos ou qualquer coisa "técnica de procedimento". Nada de "como aplicar X", "indicações de Y", "passo a passo do tratamento Z".`,
    `Tom da marca: ${brandVoice || 'Empresário que fala com empresário. Direto, sem rodeio, provocador. Mostra bastidor de negócio, números, decisões. Zero tom de "dica técnica".'}`,
    `Sempre pense em: porquê fazer (estratégia), o que fazer (tema), como fazer (operacional minucioso).`,
    `Responda em PT-BR. Seja específico, acionável e diretivo — nada de generalidades.`,
  ].join('\n');
}

async function callAI(system: string, user: string, tool?: any) {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

  const body: any = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  if (tool) {
    body.tools = [tool];
    body.tool_choice = { type: 'function', function: { name: tool.function.name } };
  }

  const res = await fetch(LOVABLE_AI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 429) throw new Error('rate_limit');
  if (res.status === 402) throw new Error('payment_required');
  if (!res.ok) throw new Error(`AI error ${res.status}: ${await res.text()}`);

  const data = await res.json();
  if (tool) {
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    return args ? JSON.parse(args) : null;
  }
  return data.choices?.[0]?.message?.content || '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { action, talent, payload } = await req.json();
    if (!talent?.name) throw new Error('talent required');

    const system = systemFor(talent.name, talent.niche || 'estética', talent.brand_voice);

    if (action === 'generate_strategy') {
      const tool = {
        type: 'function',
        function: {
          name: 'return_strategy',
          description: 'Retorna estratégia trimestral de conteúdo.',
          parameters: {
            type: 'object',
            properties: {
              positioning: { type: 'string' },
              audience: { type: 'string' },
              tone: { type: 'string' },
              goals: { type: 'array', items: { type: 'string' } },
              big_bets: { type: 'array', items: { type: 'string' } },
              suggested_pillars: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    mix_percentage: { type: 'number' },
                    platforms: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['name', 'description', 'mix_percentage', 'platforms'],
                },
              },
            },
            required: ['positioning', 'audience', 'tone', 'goals', 'big_bets', 'suggested_pillars'],
          },
        },
      };
      const prompt = `Crie a estratégia de conteúdo do trimestre ${payload?.quarter || 'atual'} de ${payload?.year || new Date().getFullYear()} para ${talent.name}. Objetivo principal: ${payload?.objective || 'gerar leads qualificados de profissionais de estética interessados em mentoria de vendas, marketing e gestão'}. Lembre: público são COLEGAS profissionais, temas são NEGÓCIO (vendas, marketing, gestão, precificação, posicionamento) — nunca procedimentos técnicos. Liste 4-6 pilares com mix sugerido (soma = 100%).`;
      const result = await callAI(system, prompt, tool);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'generate_pautas') {
      const tool = {
        type: 'function',
        function: {
          name: 'return_pautas',
          description: 'Lista de pautas para o período.',
          parameters: {
            type: 'object',
            properties: {
              pautas: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    hook: { type: 'string' },
                    angle: { type: 'string' },
                    format: { type: 'string' },
                    suggested_day: { type: 'number', description: 'Dia do mês (1-28)' },
                  },
                  required: ['title', 'hook', 'angle', 'format'],
                },
              },
            },
            required: ['pautas'],
          },
        },
      };
      const tips = PLATFORM_TIPS[payload?.platform] || '';
      const prompt = `Gere ${payload?.count || 8} pautas de conteúdo para a plataforma ${payload?.platform} no pilar "${payload?.pillar_name}" (${payload?.pillar_description || ''}). Período: ${payload?.period || 'próximas 4 semanas'}. Boas práticas da plataforma: ${tips}. Cada pauta deve ter título curto, hook (gancho que prende), angle (ângulo único) e formato sugerido.`;
      const result = await callAI(system, prompt, tool);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'generate_briefing') {
      const tool = {
        type: 'function',
        function: {
          name: 'return_briefing',
          description: 'Briefing operacional minucioso.',
          parameters: {
            type: 'object',
            properties: {
              hook: { type: 'string' },
              script: { type: 'string', description: 'Roteiro completo, cena a cena se vídeo, com timestamps.' },
              cta: { type: 'string' },
              caption: { type: 'string' },
              hashtags: { type: 'string' },
              thumbnail_brief: { type: 'string' },
              production_notes: { type: 'string', description: 'Notas operacionais: cenário, figurino, props, iluminação, edição.' },
            },
            required: ['hook', 'script', 'cta', 'caption', 'hashtags', 'thumbnail_brief', 'production_notes'],
          },
        },
      };
      const tips = PLATFORM_TIPS[payload?.platform] || '';
      const prompt = `Crie o briefing operacional completo para esta pauta:\n\nTítulo: ${payload?.title}\nPilar: ${payload?.pillar_name}\nPlataforma: ${payload?.platform}\nFormato: ${payload?.format || 'a definir'}\n\nBoas práticas: ${tips}\n\nEntregue roteiro DETALHADO (mínimo 8 frases para vídeos, com indicações de tempo e tomadas), legenda otimizada, hashtags, brief de thumbnail e notas de produção.`;
      const result = await callAI(system, prompt, tool);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'generate_ideas_burst') {
      const tool = {
        type: 'function',
        function: {
          name: 'return_ideas_burst',
          description: 'Lote grande de ideias de conteúdo cobrindo múltiplos pilares e plataformas.',
          parameters: {
            type: 'object',
            properties: {
              ideas: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Título curto e provocador da ideia.' },
                    hook: { type: 'string', description: 'Gancho de abertura (1ª frase que prende).' },
                    angle: { type: 'string', description: 'Ângulo único / por que essa ideia importa agora.' },
                    pillar_name: { type: 'string', description: 'Nome do pilar entre os fornecidos. Use exatamente como veio.' },
                    platform: { type: 'string', enum: ['instagram','youtube','tiktok','threads','linkedin','pinterest','spotify'] },
                    format: { type: 'string', description: 'Ex: Reel, Carrossel, Short, Vídeo longo, Post estático, Thread.' },
                    intensity: { type: 'string', enum: ['quick_win','autoridade','viral','conversao'], description: 'Tipo da ideia.' },
                  },
                  required: ['title','hook','angle','pillar_name','platform','format','intensity'],
                },
              },
            },
            required: ['ideas'],
          },
        },
      };
      const pillars: { name: string; description?: string }[] = payload?.pillars || [];
      const platforms: string[] = payload?.platforms?.length ? payload.platforms : ['instagram','youtube','tiktok'];
      const count = Math.min(Math.max(payload?.count || 24, 6), 40);
      const extraContext = payload?.context ? `\nCONTEXTO DA SEMANA/CAMPANHA: ${payload.context}` : '';
      const pillarsList = pillars.length
        ? pillars.map((p, i) => `${i + 1}. ${p.name}${p.description ? ' — ' + p.description : ''}`).join('\n')
        : '(sem pilares definidos — invente 4-5 baseados em vendas, marketing, gestão, precificação e posicionamento)';
      const prompt = `Gere ${count} IDEIAS de conteúdo para ${talent.name} cobrindo o mix abaixo.

PILARES DISPONÍVEIS (use o nome EXATO no campo pillar_name):
${pillarsList}

PLATAFORMAS-ALVO: ${platforms.join(', ')}
${extraContext}

REGRAS:
- Distribua as ideias entre pilares e plataformas (não concentre tudo num só).
- Mistura de intensidades: ~30% quick_win (fácil de gravar hoje), ~30% autoridade (caso real / opinião forte), ~25% viral (gancho polêmico), ~15% conversao (CTA pra mentoria).
- Hook precisa ser cirúrgico: pergunta provocadora, número que choca, contradição, confissão. NADA de "Você sabia que..." ou "Hoje vou te contar...".
- Nunca conteúdo técnico de procedimento. Só negócio da estética: vendas, marketing, gestão, preço, time, posicionamento, mentalidade de empresário.
- Formato adequado à plataforma (Reel/Short pra IG/TikTok/YT-Short, Vídeo longo pra YouTube, Thread pra Threads/LinkedIn, etc.).
- Títulos curtos (máx 70 chars). Hooks de 1 frase.`;
      const result = await callAI(system, prompt, tool);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    const msg = e?.message || 'unknown';
    const status = msg === 'rate_limit' ? 429 : msg === 'payment_required' ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
