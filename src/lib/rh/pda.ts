/**
 * PDA — Programa de Desenvolvimento de Anjos.
 * Opções, cores e cálculos usados na ficha e na visão PDA do RH.
 */

export type PdaOption = { value: string; label: string; color: string };

// Paleta do PDA (valores de dado, no mesmo padrão das badges coloridas do ROY)
export const PDA_COLORS = {
  verde: "#16a34a",
  verdeAmarelado: "#84cc16",
  verdeAzulado: "#14b8a6",
  amarelo: "#eab308",
  laranja: "#f97316",
  laranjaClaro: "#fb923c",
  vermelho: "#dc2626",
  roxo: "#a855f7",
  aqua: "#06b6d4",
  azul: "#3b82f6",
  cinza: "#6b7280",
} as const;

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
];

export const LEVEL_OPTIONS: PdaOption[] = [
  { value: "Junior", label: "Junior", color: C.vermelho },
  { value: "Pleno", label: "Pleno", color: C.amarelo },
  { value: "Sênior", label: "Sênior", color: C.verde },
];

export const ROLE_PROFILE_OPTIONS: PdaOption[] = [
  { value: "Executor/Comunicador", label: "Executor/Comunicador", color: C.cinza },
  { value: "Executor/Analítico", label: "Executor/Analítico", color: C.cinza },
  { value: "Analítico/Executor", label: "Analítico/Executor", color: C.cinza },
  { value: "Analítico/Planejador", label: "Analítico/Planejador", color: C.cinza },
];

export const PROFILE_OPTIONS: PdaOption[] = [
  { value: "Executor", label: "Executor", color: C.vermelho },
  { value: "Comunicador", label: "Comunicador", color: C.amarelo },
  { value: "Analítico", label: "Analítico", color: C.laranja },
  { value: "Planejador", label: "Planejador", color: C.azul },
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

export const MENTAL_MODEL_OPTIONS: PdaOption[] = [
  { value: "Filho de Lobo", label: "Filho de Lobo", color: C.verde },
  { value: "Filha de Lobo", label: "Filha de Lobo", color: C.verde },
  { value: "Filho de Hiena", label: "Filho de Hiena", color: C.vermelho },
  { value: "Filha de Hiena", label: "Filha de Hiena", color: C.vermelho },
];

export const THERMOMETER_OPTIONS: PdaOption[] = [
  { value: "Promoção", label: "Promoção", color: C.verde },
  { value: "Neutro", label: "Neutro", color: C.amarelo },
  { value: "Demissão", label: "Demissão", color: C.vermelho },
];

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

/** Cargos do PDA — combinados com os cargos já cadastrados no sistema. */
export const POSITION_OPTIONS: string[] = [
  "CEO",
  "COO",
  "Gestor",
  "Coordenador",
  "Supervisor",
  "Analista Rh",
  "Assistente",
  "Auxiliar",
  "Anjo Consultor II",
  "Anjo Consultor I",
  "Anjo Backoffice",
  "Anjo Suporte",
  "Designer Instrucional",
  "Designer Gráfico",
  "Videomaker",
  "Gestor de tráfego",
  "Comercial 1",
  "Comercial 2",
  "Advogado",
  "Social Media",
  "Webdesigner",
  "Gestor de Projetos",
  "AnjoGuia",
  "Planilhas",
  "Estagiário",
  "Social Seller",
  "Analista Financeiro",
  "Analista Comercial",
  "Analista de Dados",
  "Analista de Sistemas",
  "CX - Customer Experience",
  "BPO",
  "Contador",
  "Copywriter",
  "Redator Publicitário",
];

export function optionColor(options: PdaOption[], value?: string | null): string {
  if (!value) return C.cinza;
  return options.find((o) => o.value === value)?.color || C.cinza;
}

/** % de sinergia entre o perfil da vaga ("Dominante/Secundário") e os perfis da pessoa. */
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

  if (dom && sec && dom === expDom && sec === expSec) return 100;
  if (dom && sec && dom === expSec && sec === expDom) return 75;
  if (dom && dom === expDom) return 50;
  if (sec && sec === expSec) return 50;
  if ((dom && dom === expSec) || (sec && sec === expDom)) return 25;
  return 0;
}

export function synergyFromPct(pct: number | null | undefined): boolean | null {
  if (pct == null) return null;
  return pct >= 75;
}

/** Tempo de casa em meses (até hoje ou até o desligamento). */
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
