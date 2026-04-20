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
