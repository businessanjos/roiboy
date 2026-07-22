// Perguntas fixas que alimentam o "Panorama de Mercado" da Market Intelligence.
// Cada item vira um card de destaque no topo da página.
export type BenchmarkQuery = {
  key: string;
  label: string;
  focus: string;
  query: string;
  hint?: string;
  icon: "clinics" | "franchise" | "units" | "solo" | "derm" | "hof";
};

// IMPORTANTE: Eternum atende CLÍNICAS DE ESTÉTICA AVANÇADA / MÉDICA (procedimentos
// estéticos, injetáveis, laser, HOF, dermato). NÃO atende salões de beleza, barbearias,
// cabeleireiros, manicure, depilação simples ou estética capilar. Toda pergunta abaixo
// precisa deixar isso EXPLÍCITO para a Perplexity não devolver o universo "beleza".
const EXCLUSAO = "IMPORTANTE: considere apenas clínicas de estética avançada/médica (procedimentos estéticos, injetáveis, laser, tecnologias, harmonização, dermato). EXCLUA salões de beleza, barbearias, cabeleireiros, manicure/pedicure, depilação simples, estética capilar, SPAs de relaxamento e centros de bem-estar sem procedimentos estéticos.";

export const benchmarkQueries: BenchmarkQuery[] = [
  {
    key: "clinicas-estetica",
    label: "Clínicas de estética avançada (BR)",
    focus: "tam",
    icon: "clinics",
    hint: "Somente clínicas com procedimentos estéticos/médicos",
    query: `Quantas CLÍNICAS DE ESTÉTICA AVANÇADA existem no Brasil hoje (estabelecimentos que realizam procedimentos estéticos, injetáveis, laser, tecnologias, harmonização facial/corporal)? ${EXCLUSAO} Traga número total, metodologia, recorte por CNAE relevante (ex.: 8690-9/04 atividades de atenção à saúde humana; 9602-5/02 atividades de estetica e outros serviços de cuidados com a beleza — considere APENAS a fração que executa procedimentos avançados) e fonte oficial (Sebrae, IBGE, Receita Federal, associações do setor).`,
  },
  {
    key: "redes-franquia",
    label: "Redes de franquia de estética avançada",
    focus: "concorrentes",
    icon: "franchise",
    hint: "Redes com procedimentos estéticos (não salões)",
    query: `Quantas redes de franquia de CLÍNICAS DE ESTÉTICA AVANÇADA existem no Brasil? ${EXCLUSAO} Liste as principais redes que operam clínicas com procedimentos estéticos/injetáveis/laser (ex.: Onodera Estética, Bio Ritmo Estética, Ella Clínica, Clínica Leger e similares) com nome, ano de fundação e posicionamento. NÃO inclua Espaçolaser (depilação a laser pura), Sóbrancelhas, redes de cabeleireiro ou barbearia.`,
  },
  {
    key: "unidades-franquia",
    label: "Unidades das redes de estética",
    focus: "concorrentes",
    icon: "units",
    hint: "Total agregado de unidades das redes de estética avançada",
    query: `Para as principais REDES DE FRANQUIA DE CLÍNICAS DE ESTÉTICA AVANÇADA no Brasil (procedimentos estéticos/injetáveis/laser), informe o número de unidades por rede (últimos dados disponíveis) e o total agregado. ${EXCLUSAO} Cite fonte (ABF, sites oficiais das redes).`,
  },
  {
    key: "clinicas-individuais",
    label: "Clínicas independentes (não-rede)",
    focus: "tam",
    icon: "solo",
    hint: "Clínicas de estética avançada fora de franquias",
    query: `Do total de CLÍNICAS DE ESTÉTICA AVANÇADA no Brasil (procedimentos estéticos/injetáveis/laser/harmonização), quantas são independentes/individuais (não pertencem a redes de franquia)? ${EXCLUSAO} Traga estimativa, metodologia e fonte.`,
  },
  {
    key: "dermatologistas",
    label: "Médicos dermatologistas",
    focus: "publico",
    icon: "derm",
    hint: "Especialistas com título SBD e/ou RQE no CFM",
    query:
      "Quantos médicos dermatologistas com título de especialista pela SBD (Sociedade Brasileira de Dermatologia) e/ou registro no CFM/RQE existem no Brasil? Traga número, ano de referência e fonte oficial (SBD, CFM, Demografia Médica).",
  },
  {
    key: "hof",
    label: "Especialistas em HOF",
    focus: "publico",
    icon: "hof",
    hint: "Dentistas (CFO) + médicos com formação em HOF",
    query:
      "Quantos profissionais especialistas em Harmonização Orofacial (HOF) atuam no Brasil hoje, considerando dentistas com especialização reconhecida pelo CFO e médicos com formação em HOF? Traga números SEPARADOS por categoria (dentista vs médico) e fonte oficial (CFO, CFM, associações).",
  },
];

/**
 * Extrai um número de destaque da resposta da Perplexity.
 * Estratégia: primeiro **negrito** com dígitos → primeiro padrão numérico do início.
 */
export function extractHeadline(answer: string | null | undefined): {
  value: string | null;
  snippet: string;
} {
  if (!answer) return { value: null, snippet: "" };
  const clean = answer.replace(/\[\d+(,\s*\d+)*\]/g, "").trim();
  const firstPara = clean.split(/\n\s*\n/)[0] ?? clean;

  // Aceita: (a) valor monetário/percentual (R$, %, mil, bi, mi) OU
  // (b) contagem de entidades do domínio (redes, unidades, clínicas, profissionais,
  //     dermatologistas, dentistas, médicos, especialistas, franquias, estabelecimentos).
  // Um "12" solto (ex.: "12 meses") continua descartado.
  const MONEY_UNIT = /R\$|%|\b(mil|milh[ãa]o|milh[õo]es|bi|bilh[ãa]o|bilh[õo]es)\b/i;
  const ENTITY_UNIT = /\b(redes?|unidades?|cl[íi]nicas?|profissionais|dermatologistas?|dentistas?|m[ée]dicos?|especialistas?|franquias?|estabelecimentos?)\b/i;
  const hasUnit = (s: string) => MONEY_UNIT.test(s) || ENTITY_UNIT.test(s);

  // 1) primeiro **texto em negrito** que tenha número + unidade
  const boldMatches = firstPara.match(/\*\*([^*]+)\*\*/g) ?? [];
  for (const raw of boldMatches) {
    const inner = raw.replace(/\*\*/g, "").trim();
    if (/\d/.test(inner) && hasUnit(inner) && inner.length <= 60) {
      return { value: inner, snippet: stripMd(firstPara) };
    }
  }

  // 2) padrão numérico + unidade monetária
  const moneyMatch = firstPara.match(
    /(R\$\s*)?(\d[\d.,]*(?:\s*[–-]\s*\d[\d.,]*)?)\s*(mil|milh[õo]es|milh[ãa]o|bi|bilh[õo]es|bilh[ãa]o|%)/i,
  );
  if (moneyMatch) {
    const val = `${moneyMatch[1] ?? ""}${moneyMatch[2].trim()}${moneyMatch[3] ? " " + moneyMatch[3] : ""}`.trim();
    return { value: val, snippet: stripMd(firstPara) };
  }

  // 3) padrão numérico + entidade do domínio (ex.: "10 redes", "800 unidades")
  const entityMatch = firstPara.match(
    /(\d[\d.,]*(?:\s*[–-]\s*\d[\d.,]*)?)\s+(redes?|unidades?|cl[íi]nicas?|profissionais|dermatologistas?|dentistas?|m[ée]dicos?|especialistas?|franquias?|estabelecimentos?)/i,
  );
  if (entityMatch) {
    return { value: `${entityMatch[1].trim()} ${entityMatch[2]}`, snippet: stripMd(firstPara) };
  }

  return { value: null, snippet: stripMd(firstPara) };
}


function stripMd(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
