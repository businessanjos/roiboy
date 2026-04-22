import type { BrandVoice } from "@/hooks/useMarketingBrandVoice";
import type { MarketingPersona } from "@/hooks/useMarketingPersona";
import type { MarketingReference } from "@/hooks/useMarketingReferences";

export type MarketingConsistencySeverity = "high" | "medium" | "low";

export interface MarketingConsistencyIssue {
  id: string;
  severity: MarketingConsistencySeverity;
  title: string;
  description: string;
  suggestions: string[];
  evidence: string[];
  relatedAreas: Array<"persona" | "brand-voice" | "references">;
}

export interface MarketingConsistencyReport {
  score: number;
  issues: MarketingConsistencyIssue[];
  blockingIssues: MarketingConsistencyIssue[];
}

const STOPWORDS = new Set([
  "para", "com", "sem", "uma", "uns", "umas", "das", "dos", "nas", "nos", "por", "que", "sua", "seu", "são", "mais", "menos", "como", "ela", "ele", "del", "das", "the", "and", "de", "da", "do", "em", "ou", "no", "na", "um", "uma", "ser", "ter", "aos", "às", "pra", "pro", "sobre", "muito", "muita", "isso", "essa", "esse",
]);

function normalize(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function tokenize(values: Array<string | null | undefined>) {
  return new Set(
    values
      .flatMap((value) => normalize(value).split(/[^a-z0-9]+/g))
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !STOPWORDS.has(token)),
  );
}

function overlap(a: Set<string>, b: Set<string>) {
  const common = Array.from(a).filter((token) => b.has(token));
  return { count: common.length, tokens: common.slice(0, 6) };
}

function compact(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean) as string[];
}

export function buildMarketingConsistencyReport(input: {
  persona?: Partial<MarketingPersona> | null;
  voice?: Partial<BrandVoice> | null;
  references?: MarketingReference[] | null;
}): MarketingConsistencyReport {
  const persona = input.persona;
  const voice = input.voice;
  const references = input.references || [];
  const issues: MarketingConsistencyIssue[] = [];

  const personaIdentity = compact([
    persona?.profession,
    persona?.business_type,
    persona?.business_size,
    persona?.location,
    ...(persona?.vocabulary || []),
    ...(persona?.references_consumed || []),
    ...(persona?.channels || []),
    ...(persona?.desires || []),
    ...(persona?.pains || []),
  ]);
  const voicePositioning = compact([
    voice?.niche,
    voice?.target_audience,
    voice?.personality,
    voice?.emoji_style,
    voice?.hashtag_strategy,
    ...(voice?.tone_keywords || []),
    ...(voice?.signature_phrases || []),
    ...(voice?.forbidden_words || []),
  ]);
  const referenceTexts = references.flatMap((reference) => [
    reference.title,
    reference.notes,
    reference.source_url,
    reference.url,
    ...(reference.tags || []),
  ]);

  const personaTokens = tokenize(personaIdentity);
  const voiceTokens = tokenize(voicePositioning);
  const referenceTokens = tokenize(referenceTexts);
  const forbiddenTokens = tokenize(voice?.forbidden_words || []);
  const signatureTokens = tokenize(voice?.signature_phrases || []);

  if (voice?.niche && (persona?.profession || persona?.business_type)) {
    const nicheTokens = tokenize([voice.niche]);
    const personaBizTokens = tokenize([persona.profession, persona.business_type]);
    const shared = overlap(nicheTokens, personaBizTokens);
    if (shared.count === 0) {
      issues.push({
        id: "voice-niche-vs-persona",
        severity: "high",
        title: "O nicho do tom de voz não combina com a persona",
        description: "O nicho salvo no Brand Voice parece falar com outro tipo de negócio ou profissional em relação à persona atual.",
        suggestions: [
          "Ajuste o campo Nicho no tom de voz para refletir a profissão ou tipo de negócio da persona.",
          "Se a persona mudou, revise também vocabulário e referências consumidas para manter consistência.",
        ],
        evidence: [`Persona: ${compact([persona.profession, persona.business_type]).join(" · ")}`, `Tom de voz: ${voice.niche}`],
        relatedAreas: ["persona", "brand-voice"],
      });
    }
  }

  if (voice?.target_audience && (persona?.profession || persona?.age_range || persona?.gender || persona?.location)) {
    const audienceTokens = tokenize([voice.target_audience]);
    const personaAudienceTokens = tokenize([persona.profession, persona.age_range, persona.gender, persona.location]);
    const shared = overlap(audienceTokens, personaAudienceTokens);
    if (shared.count === 0) {
      issues.push({
        id: "voice-audience-vs-persona",
        severity: "medium",
        title: "O público descrito no tom de voz está distante da persona",
        description: "A descrição de público-alvo do Brand Voice não reaproveita sinais claros da persona definida para Marketing.",
        suggestions: [
          "Reescreva o público-alvo usando profissão, faixa etária, localização ou contexto real da persona.",
          "Inclua no Brand Voice palavras que já aparecem em dores, desejos ou contexto da persona.",
        ],
        evidence: [`Persona: ${compact([persona.profession, persona.age_range, persona.location]).join(" · ")}`, `Público no tom de voz: ${voice.target_audience}`],
        relatedAreas: ["persona", "brand-voice"],
      });
    }
  }

  if (forbiddenTokens.size > 0) {
    const voiceTextTokens = tokenize([voice?.personality, ...(voice?.tone_keywords || []), ...(voice?.signature_phrases || [])]);
    const shared = overlap(forbiddenTokens, voiceTextTokens);
    if (shared.count > 0) {
      issues.push({
        id: "forbidden-words-inside-voice",
        severity: "high",
        title: "Há termos proibidos aparecendo no próprio tom de voz",
        description: "Palavras marcadas para evitar ainda aparecem em frases assinatura, personalidade ou palavras de tom.",
        suggestions: [
          "Remova esses termos das frases assinatura e palavras-chave do tom.",
          "Troque por expressões equivalentes que preservem a intenção sem contradizer a regra.",
        ],
        evidence: [`Termos em conflito: ${shared.tokens.join(", ")}`],
        relatedAreas: ["brand-voice"],
      });
    }

    const refsForbidden = overlap(forbiddenTokens, referenceTokens);
    if (refsForbidden.count > 0) {
      issues.push({
        id: "forbidden-words-inside-references",
        severity: "high",
        title: "As referências salvas reforçam termos que o tom de voz quer evitar",
        description: "Algumas referências atuais contêm palavras ou sinais que contradizem o Brand Voice salvo.",
        suggestions: [
          "Remova ou reetiquete referências que puxam para a direção errada.",
          "Atualize notas e tags das referências para explicitar o que deve ser aproveitado ou evitado.",
        ],
        evidence: [`Termos encontrados nas referências: ${refsForbidden.tokens.join(", ")}`],
        relatedAreas: ["brand-voice", "references"],
      });
    }
  }

  if (references.length > 0 && personaTokens.size > 0) {
    const shared = overlap(personaTokens, referenceTokens);
    if (shared.count === 0) {
      issues.push({
        id: "references-vs-persona",
        severity: "medium",
        title: "As referências não estão ancoradas na persona salva",
        description: "Nenhum sinal importante da persona apareceu nas tags, títulos ou notas das referências atuais.",
        suggestions: [
          "Adicione tags e notas nas referências usando dores, desejos, vocabulário e canais da persona.",
          "Substitua referências visuais ou conceituais que conversem com outro público.",
        ],
        evidence: [
          `Persona usada: ${personaIdentity.slice(0, 4).join(" · ") || "sem detalhes suficientes"}`,
          `Referências analisadas: ${references.length}`,
        ],
        relatedAreas: ["persona", "references"],
      });
    }
  }

  if (references.length > 0 && voiceTokens.size > 0) {
    const shared = overlap(voiceTokens, referenceTokens);
    if (shared.count === 0) {
      issues.push({
        id: "references-vs-voice",
        severity: "medium",
        title: "As referências não reforçam o tom de voz atual",
        description: "As referências salvas não carregam sinais suficientes do posicionamento, estilo ou mensagens do Brand Voice.",
        suggestions: [
          "Inclua notas curtas explicando qual tom, estética ou mensagem cada referência inspira.",
          "Reforce tags com palavras do tom, frases assinatura ou elementos do nicho.",
        ],
        evidence: [
          `Tom analisado: ${voicePositioning.slice(0, 4).join(" · ") || "sem detalhes suficientes"}`,
          `Referências analisadas: ${references.length}`,
        ],
        relatedAreas: ["brand-voice", "references"],
      });
    }
  }

  if (references.length > 0) {
    const lowContextReferences = references.filter((reference) => !(reference.tags?.length || 0) && !reference.notes?.trim());
    if (lowContextReferences.length >= Math.ceil(references.length * 0.6)) {
      issues.push({
        id: "references-low-context",
        severity: "low",
        title: "Faltam contexto e tags nas referências",
        description: "A maioria das referências foi salva sem nota ou tag, o que reduz a confiança nas sugestões automáticas futuras.",
        suggestions: [
          "Adicione 2 a 4 tags por referência com tema, estilo e tipo de conteúdo.",
          "Use notas curtas dizendo o que copiar e o que evitar em cada inspiração.",
        ],
        evidence: [`${lowContextReferences.length} de ${references.length} referências estão sem contexto descritivo`],
        relatedAreas: ["references"],
      });
    }
  }

  if (signatureTokens.size > 0 && personaTokens.size > 0) {
    const shared = overlap(signatureTokens, personaTokens);
    if (shared.count === 0) {
      issues.push({
        id: "signature-vs-persona-language",
        severity: "medium",
        title: "As frases assinatura não falam a língua da persona",
        description: "As frases assinatura atuais parecem genéricas ou distantes do vocabulário, dores e desejos da persona definida.",
        suggestions: [
          "Reescreva as frases assinatura usando termos que a persona já consome e reconhece.",
          "Conecte pelo menos uma frase a uma dor ou desejo central da persona.",
        ],
        evidence: [
          `Frases assinatura: ${(voice?.signature_phrases || []).slice(0, 2).join(" · ") || "não definidas"}`,
          `Vocabulário da persona: ${(persona?.vocabulary || []).slice(0, 3).join(" · ") || "não definido"}`,
        ],
        relatedAreas: ["persona", "brand-voice"],
      });
    }
  }

  const score = Math.max(0, 100 - issues.reduce((total, issue) => total + (issue.severity === "high" ? 22 : issue.severity === "medium" ? 12 : 5), 0));
  const blockingIssues = issues.filter((issue) => issue.severity !== "low");

  return { score, issues, blockingIssues };
}