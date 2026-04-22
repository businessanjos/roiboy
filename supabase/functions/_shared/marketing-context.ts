// Helper compartilhado: monta o bloco de contexto "Tom de Voz + Persona"
// para ser injetado em prompts de IA da área de Marketing.

export interface BrandVoiceLike {
  personality?: string | null;
  tone_keywords?: string[] | null;
  forbidden_words?: string[] | null;
  signature_phrases?: string[] | null;
  emoji_style?: string | null;
  hashtag_strategy?: string | null;
  values_and_mission?: string | null;
  target_audience?: string | null;
  niche?: string | null;
  ai_summary?: string | null;
}

export interface PersonaLike {
  name?: string | null;
  profession?: string | null;
  education?: string | null;
  age_range?: string | null;
  gender?: string | null;
  location?: string | null;
  business_type?: string | null;
  business_size?: string | null;
  revenue_range?: string | null;
  years_in_business?: string | null;
  pains?: string[] | null;
  desires?: string[] | null;
  objections?: string[] | null;
  emotional_triggers?: string[] | null;
  vocabulary?: string[] | null;
  channels?: string[] | null;
  references_consumed?: string[] | null;
  daily_routine?: string | null;
  biggest_dream?: string | null;
  biggest_fear?: string | null;
  ai_summary?: string | null;
}

const list = (arr: string[] | null | undefined) =>
  Array.isArray(arr) && arr.length ? arr.join(", ") : "";

const line = (label: string, value: string | null | undefined) =>
  value && String(value).trim() ? `- ${label}: ${value}` : "";

export function buildBrandVoiceBlock(voice: BrandVoiceLike | null | undefined): string {
  if (!voice) return "";
  const lines = [
    line("Personalidade", voice.personality),
    line("Palavras-chave do tom", list(voice.tone_keywords)),
    line("PALAVRAS PROIBIDAS (NUNCA usar)", list(voice.forbidden_words)),
    line("Frases assinatura", (voice.signature_phrases || []).join(" | ")),
    line("Estilo de emoji", voice.emoji_style),
    line("Estratégia de hashtags", voice.hashtag_strategy),
    line("Valores e missão", voice.values_and_mission),
    line("Resumo do tom", voice.ai_summary),
  ].filter(Boolean);
  if (!lines.length) return "";
  return `\n\n=== TOM DE VOZ DA MARCA (use SEMPRE) ===\n${lines.join("\n")}`;
}

export function buildPersonaBlock(persona: PersonaLike | null | undefined): string {
  if (!persona) return "";
  const lines = [
    line("Profissão", persona.profession),
    line("Formação", persona.education),
    line("Faixa etária", persona.age_range),
    line("Gênero", persona.gender),
    line("Localização", persona.location),
    line("Tipo de negócio", persona.business_type),
    line("Porte", persona.business_size),
    line("Faturamento mensal", persona.revenue_range),
    line("Tempo de mercado", persona.years_in_business),
    line("DORES principais", list(persona.pains)),
    line("DESEJOS / Transformação", list(persona.desires)),
    line("OBJEÇÕES comuns", list(persona.objections)),
    line("Gatilhos emocionais", list(persona.emotional_triggers)),
    line("Vocabulário do nicho (USE essas palavras)", list(persona.vocabulary)),
    line("Canais frequentados", list(persona.channels)),
    line("Referências consumidas", list(persona.references_consumed)),
    line("Rotina", persona.daily_routine),
    line("Maior sonho", persona.biggest_dream),
    line("Maior medo", persona.biggest_fear),
    line("Resumo", persona.ai_summary),
  ].filter(Boolean);
  if (!lines.length) return "";
  const header = persona.name ? `=== PERSONA: ${persona.name} ===` : "=== PERSONA DO PÚBLICO-ALVO ===";
  return `\n\n${header}\nFale DIRETAMENTE com essa pessoa. Use a linguagem dela. Toque nas dores, desejos e gatilhos abaixo:\n${lines.join("\n")}`;
}

// Busca brand voice + persona default em uma única chamada
export async function fetchVoiceAndPersona(supabase: any, accountId: string) {
  const [voiceRes, personaRes] = await Promise.all([
    supabase.from("marketing_brand_voice").select("*").eq("account_id", accountId).maybeSingle(),
    supabase.from("marketing_personas").select("*").eq("account_id", accountId).eq("is_default", true).maybeSingle(),
  ]);
  return {
    voice: voiceRes.data || null,
    persona: personaRes.data || null,
  };
}

// ====================== Instagram performance context ======================

export interface InstagramContext {
  profile: { username: string; followers_count: number | null; display_name: string | null } | null;
  topPosts: Array<{
    post_type: string;
    caption: string | null;
    likes: number;
    comments: number;
    views: number;
    saves: number;
    shares: number;
    reach: number;
    engagement_rate: number;
    posted_at: string;
    theme: string | null;
    ai_objective: string | null;
    permalink: string | null;
  }>;
  formatStats: Array<{ post_type: string; avg_engagement: number; count: number }>;
  topHashtags: Array<{ tag: string; uses: number; avg_engagement: number }>;
}

const HASHTAG_REGEX = /#([\p{L}0-9_]+)/giu;

function extractHashtags(caption: string | null): string[] {
  if (!caption) return [];
  const matches = caption.matchAll(HASHTAG_REGEX);
  return Array.from(matches, (m) => m[1].toLowerCase());
}

export async function fetchInstagramContext(
  supabase: any,
  accountId: string,
  profileId?: string | null,
): Promise<InstagramContext | null> {
  let profile: any = null;
  if (profileId) {
    const { data } = await supabase
      .from("instagram_profiles")
      .select("id, username, display_name, followers_count, account_id")
      .eq("id", profileId)
      .maybeSingle();
    // Só usa o perfil se pertencer à conta — segurança
    if (data && data.account_id === accountId) profile = data;
  }
  if (!profile) {
    const { data } = await supabase
      .from("instagram_profiles")
      .select("id, username, display_name, followers_count")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .order("followers_count", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    profile = data;
  }

  if (!profile) return null;

  // Últimos 90 dias
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: posts } = await supabase
    .from("instagram_posts")
    .select("post_type, caption, likes, comments, views, saves, shares, reach, engagement_rate, posted_at, theme, ai_objective, permalink")
    .eq("profile_id", profile.id)
    .gte("posted_at", since)
    .order("engagement_rate", { ascending: false, nullsFirst: false })
    .limit(200);

  const all = (posts || []) as any[];

  // Top 10 posts por engagement
  const topPosts = all.slice(0, 10).map((p) => ({
    post_type: p.post_type,
    caption: p.caption,
    likes: p.likes || 0,
    comments: p.comments || 0,
    views: p.views || 0,
    saves: p.saves || 0,
    shares: p.shares || 0,
    reach: p.reach || 0,
    engagement_rate: Number(p.engagement_rate) || 0,
    posted_at: p.posted_at,
    theme: p.theme,
    ai_objective: p.ai_objective,
    permalink: p.permalink,
  }));

  // Stats por formato
  const byFormat: Record<string, { sum: number; count: number }> = {};
  for (const p of all) {
    const key = p.post_type || "other";
    byFormat[key] = byFormat[key] || { sum: 0, count: 0 };
    byFormat[key].sum += Number(p.engagement_rate) || 0;
    byFormat[key].count += 1;
  }
  const formatStats = Object.entries(byFormat)
    .map(([post_type, v]) => ({
      post_type,
      avg_engagement: v.count ? +(v.sum / v.count).toFixed(2) : 0,
      count: v.count,
    }))
    .sort((a, b) => b.avg_engagement - a.avg_engagement);

  // Top hashtags por uso e engagement médio
  const tagMap: Record<string, { uses: number; sum: number }> = {};
  for (const p of all) {
    const tags = extractHashtags(p.caption);
    const er = Number(p.engagement_rate) || 0;
    for (const t of tags) {
      tagMap[t] = tagMap[t] || { uses: 0, sum: 0 };
      tagMap[t].uses += 1;
      tagMap[t].sum += er;
    }
  }
  const topHashtags = Object.entries(tagMap)
    .map(([tag, v]) => ({ tag, uses: v.uses, avg_engagement: v.uses ? +(v.sum / v.uses).toFixed(2) : 0 }))
    .filter((h) => h.uses >= 2)
    .sort((a, b) => b.avg_engagement - a.avg_engagement || b.uses - a.uses)
    .slice(0, 15);

  return {
    profile: {
      username: profile.username,
      display_name: profile.display_name,
      followers_count: profile.followers_count,
    },
    topPosts,
    formatStats,
    topHashtags,
  };
}

export function buildInstagramContextBlock(ctx: InstagramContext | null | undefined): string {
  if (!ctx || !ctx.profile) return "";
  const lines: string[] = [];
  lines.push(`Perfil: @${ctx.profile.username}${ctx.profile.followers_count ? ` (${ctx.profile.followers_count} seguidores)` : ""}`);

  if (ctx.formatStats.length) {
    lines.push("\nFORMATOS QUE MAIS ENGAJAM (engagement médio %):");
    ctx.formatStats.slice(0, 5).forEach((f) => {
      lines.push(`- ${f.post_type}: ${f.avg_engagement}% (${f.count} posts)`);
    });
  }

  if (ctx.topHashtags.length) {
    lines.push("\nHASHTAGS DE MELHOR PERFORMANCE (priorize estas):");
    ctx.topHashtags.slice(0, 10).forEach((h) => {
      lines.push(`- #${h.tag} — ${h.avg_engagement}% eng. médio em ${h.uses} usos`);
    });
  }

  if (ctx.topPosts.length) {
    lines.push("\nTOP 10 POSTS RECENTES (use como referência de tema/formato/abordagem):");
    ctx.topPosts.forEach((p, i) => {
      const captionShort = (p.caption || "").replace(/\s+/g, " ").slice(0, 140);
      lines.push(
        `${i + 1}. [${p.post_type}${p.theme ? ` · ${p.theme}` : ""}${p.ai_objective ? ` · ${p.ai_objective}` : ""}] ${p.engagement_rate}% eng · ${p.likes} likes · ${p.comments} coment · ${p.views} views — "${captionShort}"`,
      );
    });
  }

  return `\n\n=== PERFORMANCE REAL DO INSTAGRAM CONECTADO (use SEMPRE como base) ===\nAdapte cada tendência aos formatos, temas e hashtags que JÁ funcionam para esta conta.\n${lines.join("\n")}`;
}
