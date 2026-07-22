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

export const benchmarkQueries: BenchmarkQuery[] = [
  {
    key: "clinicas-estetica",
    label: "Clínicas de estética no Brasil",
    focus: "tam",
    icon: "clinics",
    hint: "Total de estabelecimentos (Sebrae / CNAE / IBGE)",
    query:
      "Quantas clínicas de estética existem no Brasil hoje? Traga número total, fonte oficial (Sebrae, ABIHPEC, Receita Federal/CNAE 8690-9/04, IBGE) e recorte por região se possível.",
  },
  {
    key: "redes-franquia",
    label: "Redes de franquia de estética",
    focus: "concorrentes",
    icon: "franchise",
    hint: "Principais redes (Onodera, Espaçolaser, etc.)",
    query:
      "Quantas redes de franquia de clínicas de estética existem no Brasil? Liste as principais redes (ex.: Onodera, Sóbrancelhas, Espaçolaser, Bio Ritmo Estética, Ella Clínica, etc.), com nome, ano de fundação e posicionamento.",
  },
  {
    key: "unidades-franquia",
    label: "Unidades por rede de franquia",
    focus: "concorrentes",
    icon: "units",
    hint: "Total agregado de unidades (ABF)",
    query:
      "Para as principais redes de franquia de clínicas de estética no Brasil, informe o número de unidades por rede (últimos dados disponíveis) e o total agregado. Cite fonte (ABF, sites oficiais das redes).",
  },
  {
    key: "clinicas-individuais",
    label: "Clínicas independentes",
    focus: "tam",
    icon: "solo",
    hint: "Clínicas fora de redes de franquia",
    query:
      "Do total de clínicas de estética no Brasil, quantas são independentes/individuais (não pertencem a redes de franquia)? Traga estimativa, metodologia e fonte.",
  },
  {
    key: "dermatologistas",
    label: "Médicos dermatologistas",
    focus: "publico",
    icon: "derm",
    hint: "Especialistas com título SBD/RQE",
    query:
      "Quantos médicos dermatologistas com título de especialista pela SBD (Sociedade Brasileira de Dermatologia) e/ou registro no CFM/RQE existem no Brasil? Traga número, ano de referência e fonte oficial.",
  },
  {
    key: "hof",
    label: "Especialistas em HOF",
    focus: "publico",
    icon: "hof",
    hint: "Dentistas + médicos com formação em HOF",
    query:
      "Quantos profissionais especialistas em Harmonização Orofacial (HOF) atuam no Brasil hoje, considerando dentistas com especialização reconhecida pelo CFO e médicos com formação em HOF? Traga números separados por categoria (dentista vs médico) e fonte oficial (CFO, CFM, associações).",
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

  // 1) primeiro **texto** que tenha dígito ou %
  const boldMatches = firstPara.match(/\*\*([^*]+)\*\*/g) ?? [];
  for (const raw of boldMatches) {
    const inner = raw.replace(/\*\*/g, "").trim();
    if (/\d/.test(inner) && inner.length <= 60) {
      return { value: inner, snippet: stripMd(firstPara) };
    }
  }

  // 2) padrão numérico com unidade
  const numMatch = firstPara.match(
    /(cerca de\s+|aproximadamente\s+|~\s*)?(\d[\d.\,]*\s*[–-]?\s*\d*[\d.\,]*)\s*(mil|milhões?|milhão|bi|bilhões?|%)?/i,
  );
  if (numMatch) {
    const val = `${numMatch[2].trim()}${numMatch[3] ? " " + numMatch[3] : ""}`.trim();
    return { value: val, snippet: stripMd(firstPara) };
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
