/**
 * PDA — Programa de Desenvolvimento de Anjos.
 * Opções, cores e cálculos usados na ficha e na visão PDA do RH.
 * As listas padrão espelham o projeto "RH - PDA ANJOS" do Asana.
 */

export type PdaOption = { value: string; label: string; color: string };

// Paleta do PDA (hex de fundo do chip — mesmas cores do Asana)
export const PDA_COLORS = {
  verde: "#7cc39a",
  verdeAmarelado: "#aecf55",
  verdeAzulado: "#4ecbc4",
  amarelo: "#f8df72",
  laranja: "#ec8d71",
  laranjaClaro: "#f1bd6c",
  vermelho: "#f06a6a",
  roxo: "#c996e2",
  aqua: "#9ee7e3",
  azul: "#8fb0ee",
  cinza: "#c6c3c0",
} as const;

/** Texto escuro usado sobre os chips coloridos do PDA. */
export const PDA_CHIP_TEXT = "#27241f";

const C = PDA_COLORS;

export const REGISTRATION_COMPANY_OPTIONS: PdaOption[] = [
  { value: "Eternum Club Mentoring", label: "Eternum Club Mentoring", color: C.verde },
  { value: "Anjos Business Consultoria", label: "Anjos Business Consultoria", color: C.vermelho },
];

export const HIERARCHY_OPTIONS: PdaOption[] = [
  { value: "C-level", label: "C-level", color: C.verde },
  { value: "Gestor", label: "Gestor", color: C.verde },
  { value: "Coordenador", label: "Coordenador", color: C.verdeAmarelado },
  { value: "Supervisor", label: "Supervisor", color: C.verdeAmarelado },
  { value: "Analista", label: "Analista", color: C.laranjaClaro },
  { value: "Assistente", label: "Assistente", color: C.amarelo },
  { value: "Auxiliar", label: "Auxiliar", color: C.vermelho },
  { value: "Estágio", label: "Estágio", color: C.vermelho },
];

export const SECTOR_OPTIONS: PdaOption[] = [
  { value: "Comercial", label: "Comercial", color: C.verde },
  { value: "Marketing", label: "Marketing", color: C.roxo },
  { value: "Suporte/Atendimento", label: "Suporte/Atendimento", color: C.aqua },
  { value: "Financeiro", label: "Financeiro", color: C.laranjaClaro },
  { value: "RH", label: "RH", color: C.amarelo },
  { value: "Jurídico", label: "Jurídico", color: C.verdeAmarelado },
  { value: "Bem estar", label: "Bem estar", color: C.verdeAzulado },
  { value: "Educacional", label: "Educacional", color: C.cinza },
  { value: "Administrativo", label: "Administrativo", color: C.vermelho },
  // Departamentos que já existem no ROY
  { value: "Customer Success", label: "CS - Customer Success", color: C.azul },
  { value: "Operação", label: "Operação", color: C.laranja },
];

export const LEVEL_OPTIONS: PdaOption[] = [
  { value: "Junior", label: "Junior", color: C.vermelho },
  { value: "Pleno", label: "Pleno", color: C.amarelo },
  { value: "Sênior", label: "Sênior", color: C.verde },
];

export const PROFILE_OPTIONS: PdaOption[] = [
  { value: "Executor", label: "Executor", color: C.vermelho },
  { value: "Comunicador", label: "Comunicador", color: C.amarelo },
  { value: "Analítico", label: "Analítico", color: C.laranja },
  { value: "Planejador", label: "Planejador", color: C.azul },
];

/** Perfil da vaga = par primário/secundário. */
export const ROLE_PROFILE_OPTIONS: PdaOption[] = [
  { value: "Executor/Comunicador", label: "Executor/Comunicador", color: C.vermelho },
  { value: "Executor/Analítico", label: "Executor/Analítico", color: C.vermelho },
  { value: "Analítico/Executor", label: "Analítico/Executor", color: C.laranja },
  { value: "Analítico/Planejador", label: "Analítico/Planejador", color: C.laranja },
];

export const EFFORT_OPTIONS: PdaOption[] = [
  { value: "Baixo esforço", label: "Baixo esforço", color: C.amarelo },
  { value: "Médio esforço", label: "Médio esforço", color: C.laranja },
  { value: "Alto esforço", label: "Alto esforço", color: C.verde },
];

export const CHANGE_QUALITY_OPTIONS: PdaOption[] = [
  { value: "Muito satisfatória", label: "Muito satisfatória", color: C.verde },
  { value: "Satisfatória", label: "Satisfatória", color: C.verdeAmarelado },
  { value: "Médio", label: "Médio", color: C.amarelo },
  { value: "Insatisfatória", label: "Insatisfatória", color: C.laranja },
  { value: "Muito insatisfatória", label: "Muito insatisfatória", color: C.vermelho },
];

export const PHASE_OPTIONS: PdaOption[] = [
  { value: "Bebê", label: "Bebê", color: C.vermelho },
  { value: "Criança", label: "Criança", color: C.laranja },
  { value: "Adolescente", label: "Adolescente", color: C.amarelo },
  { value: "Adulto", label: "Adulto", color: C.verde },
];

export const TEMPERAMENT_OPTIONS: PdaOption[] = [
  { value: "Sanguíneo", label: "Sanguíneo", color: C.verde },
  { value: "Fleumático", label: "Fleumático", color: C.amarelo },
  { value: "Colérico", label: "Colérico", color: C.laranja },
  { value: "Melancólico", label: "Melancólico", color: C.vermelho },
];

/** Guardamos só Lobo/Hiena — a exibição é flexionada pelo gênero. */
export const MENTAL_MODEL_OPTIONS: PdaOption[] = [
  { value: "Lobo", label: "Lobo", color: C.verde },
  { value: "Hiena", label: "Hiena", color: C.vermelho },
];

/** "Filho de Lobo" / "Filha de Hiena" conforme o gênero da pessoa. */
export function mentalModelLabel(value?: string | null, gender?: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  const base = /hiena/i.test(raw) ? "Hiena" : /lobo/i.test(raw) ? "Lobo" : null;
  if (!base) return raw;
  const g = (gender || "").trim().toLowerCase();
  const female = g.startsWith("f") || g.startsWith("mulher");
  return `${female ? "Filha" : "Filho"} de ${base}`;
}

/** Normaliza valores antigos ("Filho de Lobo") para Lobo/Hiena. */
export function normalizeMentalModel(value?: string | null): string | null {
  if (!value) return null;
  if (/hiena/i.test(value)) return "Hiena";
  if (/lobo/i.test(value)) return "Lobo";
  return value;
}

export const THERMOMETER_OPTIONS: PdaOption[] = [
  { value: "Promoção", label: "Promoção", color: C.verde },
  { value: "Neutro", label: "Neutro", color: C.amarelo },
  { value: "Demissão", label: "Demissão", color: C.vermelho },
];

export const THERMOMETER_DEFAULT = "Neutro";

export const EDUCATION_OPTIONS: PdaOption[] = [
  { value: "Ensino médio incompleto", label: "Ensino médio incompleto", color: C.laranja },
  { value: "Ensino médio completo", label: "Ensino médio completo", color: C.vermelho },
  { value: "Ensino superior (cursando)", label: "Ensino superior (cursando)", color: C.laranjaClaro },
  { value: "Ensino superior completo", label: "Ensino superior completo", color: C.amarelo },
  { value: "Pós graduado/MBA", label: "Pós graduado/MBA", color: C.verdeAmarelado },
  { value: "Mestrado", label: "Mestrado", color: C.verde },
  { value: "Doutorado", label: "Doutorado", color: C.verdeAzulado },
];

export const YES_NO_OPTIONS: PdaOption[] = [
  { value: "sim", label: "SIM", color: C.verde },
  { value: "nao", label: "NÃO", color: C.vermelho },
];

/** Cargos do PDA (Asana) + cargos que já existiam no ROY, sem duplicar. */
export const POSITION_OPTIONS: string[] = Array.from(new Set([
  "CEO",
  "COO",
  "Gestor",
  "Coordenador",
  "Supervisor",
  "Analista RH",
  "Assistente",
  "Auxiliar",
  "Anjo Consultor I",
  "Anjo Consultor II",
  "Anjo Backoffice",
  "Anjo Suporte",
  "AnjoGuia",
  "Designer Instrucional",
  "Designer Gráfico",
  "Videomaker",
  "Webdesigner",
  "Social Media",
  "Social Seller",
  "Gestor de Tráfego",
  "Gestor de Projetos",
  "Comercial 1",
  "Comercial 2",
  "Advogado",
  "Estagiário",
  "Analista Financeiro",
  "Analista Comercial",
  "Analista de Dados",
  "Analista de Sistemas",
  "CX - Customer Experience",
  // Cargos já existentes no ROY
  "SDR",
  "Executivo Comercial",
  "Customer Success Analyst",
  "Video Maker Jr",
  "Suporte de Tecnologia",
  "Planilhas",
  "BPO",
  "Contador",
  "Copywriter",
  "Redator Publicitário",
]));

/** Campos do PDA cujas opções são configuráveis pelo RH. */
export type PdaFieldKey =
  | "registration_company"
  | "pda_hierarchy"
  | "pda_sectors"
  | "pda_level"
  | "pda_role_profile"
  | "pda_profile"
  | "pda_effort_level"
  | "pda_change_quality"
  | "pda_phase"
  | "pda_temperament"
  | "pda_mental_model"
  | "pda_thermometer"
  | "pda_education";

export const PDA_FIELDS: { key: PdaFieldKey; label: string; defaults: PdaOption[]; hint?: string }[] = [
  { key: "registration_company", label: "Empresa de registro", defaults: REGISTRATION_COMPANY_OPTIONS },
  { key: "pda_hierarchy", label: "Hierarquia", defaults: HIERARCHY_OPTIONS },
  { key: "pda_sectors", label: "Setores", defaults: SECTOR_OPTIONS, hint: "Seleção múltipla" },
  { key: "pda_level", label: "Nível", defaults: LEVEL_OPTIONS },
  { key: "pda_role_profile", label: "Perfil da vaga", defaults: ROLE_PROFILE_OPTIONS, hint: "Par primário/secundário entre Executor, Comunicador, Analítico e Planejador" },
  { key: "pda_profile", label: "Perfis (dominante e secundário)", defaults: PROFILE_OPTIONS, hint: "Usado nos campos Perfil dominante e Perfil secundário" },
  { key: "pda_effort_level", label: "Nível de esforço", defaults: EFFORT_OPTIONS, hint: "Estime o esforço referente ao PDI" },
  { key: "pda_change_quality", label: "QM - Qualidade da Mudança", defaults: CHANGE_QUALITY_OPTIONS, hint: "Classificar a qualidade da mudança do Anjo em relação ao PDI proposto" },
  { key: "pda_phase", label: "Fase", defaults: PHASE_OPTIONS },
  { key: "pda_temperament", label: "Temperamento", defaults: TEMPERAMENT_OPTIONS },
  { key: "pda_mental_model", label: "Modelo mental", defaults: MENTAL_MODEL_OPTIONS, hint: "Exibido como Filho/Filha de Lobo ou de Hiena conforme o gênero" },
  { key: "pda_thermometer", label: "Termômetro", defaults: THERMOMETER_OPTIONS, hint: "Essa pessoa está mais próxima de:" },
  { key: "pda_education", label: "Grau de escolaridade", defaults: EDUCATION_OPTIONS },
];

export const PDA_DEFAULTS_BY_FIELD: Record<PdaFieldKey, PdaOption[]> = PDA_FIELDS.reduce(
  (acc, f) => ({ ...acc, [f.key]: f.defaults }),
  {} as Record<PdaFieldKey, PdaOption[]>,
);

export function optionColor(options: PdaOption[], value?: string | null): string {
  if (!value) return C.cinza;
  return options.find((o) => o.value === value)?.color || C.cinza;
}

/**
 * % de sinergia entre o perfil da vaga ("Primário/Secundário") e os perfis da pessoa.
 * 100 = os dois na ordem · 75 = os dois alternados · 50 = só o primário bate
 * 25 = um perfil fora da ordem · 0 = nenhum bate · null = falta informação
 */
export function computeSynergyPct(
  roleProfile?: string | null,
  dominant?: string | null,
  secondary?: string | null,
): number | null {
  if (!roleProfile) return null;
  const [expDomRaw, expSecRaw] = roleProfile.split("/");
  const expDom = (expDomRaw || "").trim();
  const expSec = (expSecRaw || "").trim();
  const dom = (dominant || "").trim();
  const sec = (secondary || "").trim();
  if (!dom && !sec) return null;

  if (dom && sec && dom === expDom && sec === expSec) return 100;
  if (dom && sec && dom === expSec && sec === expDom) return 75;
  if (dom && dom === expDom) return 50;
  if ((dom && dom === expSec) || (sec && (sec === expDom || sec === expSec))) return 25;
  return 0;
}

export function synergyFromPct(pct: number | null | undefined): boolean | null {
  if (pct == null) return null;
  return pct >= 75;
}

/** Tempo de casa em meses completos (até hoje ou até o desligamento). */
export function tenureMonths(
  hireDate?: string | null,
  terminationDate?: string | null,
): number | null {
  if (!hireDate) return null;
  const start = new Date(hireDate);
  if (isNaN(start.getTime())) return null;
  const end = terminationDate ? new Date(terminationDate) : new Date();
  if (isNaN(end.getTime())) return null;
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

export function formatTenure(months: number | null | undefined): string {
  if (months == null) return "—";
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years} ano${years > 1 ? "s" : ""}` : `${years}a ${rest}m`;
}

export function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Data em dd/mm/aaaa (sem deslocamento de fuso para datas puras). */
export function formatDateBR(value?: string | null): string {
  if (!value) return "—";
  const iso = value.slice(0, 10);
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}
