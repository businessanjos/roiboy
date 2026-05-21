import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-3-flash-preview';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function loadAccountContext(account_id: string | undefined) {
  if (!account_id) return { persona: null, brandVoice: null };
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const [pRes, bvRes] = await Promise.all([
    admin
      .from('marketing_personas')
      .select('name, profession, age_range, gender, location, business_type, business_size, revenue_range, pains, desires, objections, emotional_triggers, vocabulary, biggest_dream, biggest_fear, ai_summary, notes')
      .eq('account_id', account_id)
      .eq('is_default', true)
      .maybeSingle(),
    admin
      .from('marketing_brand_voice')
      .select('personality, tone_keywords, forbidden_words, signature_phrases, target_audience, niche, values_and_mission, emoji_style, hashtag_strategy, ai_summary, example_posts')
      .eq('account_id', account_id)
      .maybeSingle(),
  ]);
  return { persona: pRes.data, brandVoice: bvRes.data };
}

function formatPersona(p: any): string {
  if (!p) return '';
  const lines: string[] = [`PERSONA (definida em Marketing > Criação > Persona):`];
  if (p.name) lines.push(`- Nome: ${p.name}`);
  if (p.profession) lines.push(`- Profissão: ${p.profession}`);
  if (p.age_range) lines.push(`- Faixa etária: ${p.age_range}`);
  if (p.gender) lines.push(`- Gênero: ${p.gender}`);
  if (p.location) lines.push(`- Localização: ${p.location}`);
  if (p.business_type) lines.push(`- Tipo de negócio: ${p.business_type}`);
  if (p.business_size) lines.push(`- Porte: ${p.business_size}`);
  if (p.revenue_range) lines.push(`- Faturamento: ${p.revenue_range}`);
  if (p.pains?.length) lines.push(`- Dores: ${p.pains.join('; ')}`);
  if (p.desires?.length) lines.push(`- Desejos: ${p.desires.join('; ')}`);
  if (p.objections?.length) lines.push(`- Objeções: ${p.objections.join('; ')}`);
  if (p.emotional_triggers?.length) lines.push(`- Gatilhos emocionais: ${p.emotional_triggers.join('; ')}`);
  if (p.vocabulary?.length) lines.push(`- Vocabulário usado: ${p.vocabulary.join('; ')}`);
  if (p.biggest_dream) lines.push(`- Maior sonho: ${p.biggest_dream}`);
  if (p.biggest_fear) lines.push(`- Maior medo: ${p.biggest_fear}`);
  if (p.ai_summary) lines.push(`- Resumo IA: ${p.ai_summary}`);
  if (p.notes) lines.push(`- Notas: ${p.notes}`);
  return lines.length > 1 ? lines.join('\n') : '';
}

function formatBrandVoice(bv: any): string {
  if (!bv) return '';
  const lines: string[] = [`TOM DE VOZ DA MARCA (definido em Marketing > Criação > Tom de Voz):`];
  if (bv.personality) lines.push(`- Personalidade: ${bv.personality}`);
  if (bv.tone_keywords?.length) lines.push(`- Tom (palavras-chave): ${bv.tone_keywords.join(', ')}`);
  if (bv.forbidden_words?.length) lines.push(`- NUNCA usar estas palavras: ${bv.forbidden_words.join(', ')}`);
  if (bv.signature_phrases?.length) lines.push(`- Bordões/frases-assinatura: ${bv.signature_phrases.join(' | ')}`);
  if (bv.target_audience) lines.push(`- Público-alvo: ${bv.target_audience}`);
  if (bv.niche) lines.push(`- Nicho: ${bv.niche}`);
  if (bv.values_and_mission) lines.push(`- Valores e missão: ${bv.values_and_mission}`);
  if (bv.emoji_style) lines.push(`- Estilo de emoji: ${bv.emoji_style}`);
  if (bv.hashtag_strategy) lines.push(`- Estratégia de hashtag: ${bv.hashtag_strategy}`);
  if (bv.ai_summary) lines.push(`- Resumo IA: ${bv.ai_summary}`);
  if (bv.example_posts?.length) lines.push(`- Exemplos de posts que funcionam:\n  • ${bv.example_posts.slice(0, 3).join('\n  • ')}`);
  return lines.length > 1 ? lines.join('\n') : '';
}

const PLATFORM_TIPS: Record<string, string> = {
  instagram: 'Reels 7-15s, hook nos 2 primeiros segundos, legenda escaneável, CTA claro.',
  youtube: 'Vídeo longo: storytelling, retention curve, thumbnail + título com curiosidade. Shorts: 30-60s, loop.',
  tiktok: 'Trends, áudio nativo, hook visual imediato, formato vertical 9:16, sem marca d\'água.',
  threads: 'Texto direto, opinião forte, perguntas abertas pra engajar.',
  linkedin: 'Tom profissional-pessoal, autoridade, casos reais, parágrafos curtos.',
  pinterest: 'Pin vertical 1000x1500, título descritivo SEO, palavra-chave forte.',
  spotify: 'Episódio de podcast: gancho narrativo nos 30s iniciais, capítulos claros, CTA no final.',
};

function systemFor(talentName: string, niche: string, brandVoice: string | null | undefined, extraPersona: string, extraBrandVoice: string) {
  const isBruna = /bruna/i.test(talentName);
  const isEverton = /everton/i.test(talentName);

  const personaBruna = [
    `PERSONA FIXA — BRUNA RYKA (núcleo imutável):`,
    `- Casada com o Everton (sócio e parceiro de vida). NUNCA aparece "viajando sozinha". Quando há viagem, é viagem ESPECIAL com o Everton — não rotina.`,
    `- Tem um cachorro chamado Ryk (parte da família, aparece no lifestyle).`,
    `- História de origem: começou como esteticista vendendo massagem a R$ 35 em casa, hoje fatura milhões. Use isso como prova social e gancho de virada de chave.`,
    `- Conceito central: "Vida Ryka" — vida de liberdade, qualidade, aproveitar o lado bom da vida com a família, SEM ostentação escrachada. Rico com elegância, nunca cafona.`,
    `- Objetivo dos posts da Bruna: elevar o NÍVEL DE CONSCIÊNCIA das profissionais de estética para QUEREREM viver a Vida Ryka.`,
  ].join('\n');

  const personaEverton = [
    `PERSONA FIXA — EVERTON (núcleo imutável):`,
    `- Casado com a Bruna, sócio no negócio. Mentor de Marketing, Vendas e Gestão.`,
    `- Linha editorial mais focada em método, números, gestão e bastidor de empresário.`,
  ].join('\n');

  return [
    `Você é Head de Conteúdo da Eternum Mentoring Club, criando estratégia para ${talentName}.`,
    `CONTEXTO CRÍTICO DO NEGÓCIO: Bruna e Everton são MENTORES de Marketing, Vendas e Gestão para clínicas de estética e clínicas médicas. Eles dobram, triplicam ou multiplicam o faturamento das clínicas dos mentorados. O público-alvo do conteúdo são COLEGAS profissionais (médicos, biomédicos, dentistas, esteticistas, donos de clínica) — NUNCA pacientes finais.`,
    isBruna ? personaBruna : '',
    isEverton ? personaEverton : '',
    extraPersona,
    extraBrandVoice,
    `TEMAS PERMITIDOS: vendas, marketing, gestão de clínica, precificação, atendimento de alto padrão, posicionamento de autoridade, mentalidade de empresário, liderança de equipe, captação de pacientes premium, branding pessoal, virada de chave de profissional para empresário, bastidor de Vida Ryka.`,
    `NUNCA crie conteúdo educativo sobre procedimentos, técnicas clínicas, indicações de produtos, protocolos estéticos ou qualquer coisa "técnica de procedimento". A Eternum NÃO vende estética nem ensina procedimento — vende mentoria de NEGÓCIO.`,
    `NUNCA invente situações que quebrem a persona: Bruna não viaja sozinha, casal não brigando, sem ostentação vulgar, sem "comprei isso por X reais".`,
    `SEMPRE que possível, ancore em MEMES e TRENDS atuais — adaptados à mensagem de negócio. Trend é casca; recheio é sempre vendas/marketing/gestão/Vida Ryka.`,
    extraBrandVoice
      ? `IMPORTANTE: o bloco "TOM DE VOZ DA MARCA" acima foi configurado pelo usuário em Marketing > Criação > Tom de Voz — siga RIGOROSAMENTE essas instruções (personalidade, palavras proibidas, bordões, emoji).`
      : `Tom da marca: ${brandVoice || 'Empresária que fala com empresária. Direta, sem rodeio, provocadora. Elegante, aspiracional, nunca escrachada.'}`,
    `Sempre pense em: porquê fazer (estratégia), o que fazer (tema), como fazer (operacional minucioso).`,
    `Responda em PT-BR. Seja específico, acionável e diretivo — nada de generalidades.`,
  ].filter(Boolean).join('\n');
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
