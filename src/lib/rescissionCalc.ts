// Cálculo de rescisão CLT (estimativa).
// Não substitui parecer contábil — usar para previsão financeira.

export type TerminationType =
  | "sem_justa_causa"
  | "pedido_demissao"
  | "acordo"
  | "justa_causa"
  | "termino_contrato"
  | "termino_experiencia"
  | "rescisao_indireta";

export type NoticeType = "trabalhado" | "indenizado" | "dispensado" | "nao_aplica";

export interface RescissionInput {
  baseSalary: number;          // salário base mensal
  avgVariable?: number;        // média de comissões/HE (últimos 12m)
  hireDate: string;            // YYYY-MM-DD
  lastDayWorked: string;       // YYYY-MM-DD
  terminationType: TerminationType;
  noticeType: NoticeType;
  noticeDays?: number;         // dias de aviso (geralmente 30 + 3 por ano, até 90)
  vacationDaysPending?: number;        // dias de férias vencidas
  hadVacationAdvance?: boolean;         // já adiantou 1/3?
  dependents?: number;                  // para IRRF
  fgtsBalance?: number;                 // saldo FGTS acumulado (para multa 40%)
}

export interface RescissionLine {
  key: string;
  label: string;
  value: number; // positivo=verba, negativo=desconto
  info?: string;
}

export interface RescissionResult {
  lines: RescissionLine[];
  gross: number;
  deductions: number;
  net: number;
  fgtsDeposit: number;       // FGTS do mês + aviso
  fgtsPenalty: number;       // multa rescisória (40% ou 20%)
  inssTotal: number;
  irrfTotal: number;
}

const round = (n: number) => Math.round(n * 100) / 100;
const monthsBetween = (a: Date, b: Date) =>
  (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() >= a.getDate() ? 0 : -1);

// INSS 2025 (faixas progressivas)
function calcINSS(base: number): number {
  if (base <= 0) return 0;
  const brackets = [
    { limit: 1518.0, rate: 0.075 },
    { limit: 2793.88, rate: 0.09 },
    { limit: 4190.83, rate: 0.12 },
    { limit: 8157.41, rate: 0.14 },
  ];
  let inss = 0;
  let prev = 0;
  for (const b of brackets) {
    if (base > b.limit) {
      inss += (b.limit - prev) * b.rate;
      prev = b.limit;
    } else {
      inss += (base - prev) * b.rate;
      return round(inss);
    }
  }
  // teto
  return round(inss);
}

// IRRF 2025 (tabela progressiva)
function calcIRRF(base: number, dependents = 0): number {
  const baseAdj = base - dependents * 189.59;
  if (baseAdj <= 2428.8) return 0;
  if (baseAdj <= 2826.65) return round(baseAdj * 0.075 - 182.16);
  if (baseAdj <= 3751.05) return round(baseAdj * 0.15 - 394.16);
  if (baseAdj <= 4664.68) return round(baseAdj * 0.225 - 675.49);
  return round(baseAdj * 0.275 - 908.73);
}

export function computeRescission(input: RescissionInput): RescissionResult {
  const {
    baseSalary, avgVariable = 0, hireDate, lastDayWorked,
    terminationType, noticeType, noticeDays = 30,
    vacationDaysPending = 0, hadVacationAdvance = false,
    dependents = 0, fgtsBalance = 0,
  } = input;

  const remun = baseSalary + avgVariable;
  const hire = new Date(hireDate);
  const last = new Date(lastDayWorked);
  const months = Math.max(0, monthsBetween(hire, last));

  // Avos do ano corrente para 13º e férias proporcionais
  const startOfYear = new Date(last.getFullYear(), 0, 1);
  const baseFor13 = hire > startOfYear ? hire : startOfYear;
  const monthsCurrent13 = Math.min(12, monthsBetween(baseFor13, last) + 1);

  // Período aquisitivo de férias proporcionais (último aniversário até desligamento)
  const yearsSinceHire = last.getFullYear() - hire.getFullYear();
  const lastAnniv = new Date(
    last.getFullYear() - (last < new Date(last.getFullYear(), hire.getMonth(), hire.getDate()) ? 1 : 0),
    hire.getMonth(),
    hire.getDate(),
  );
  const monthsProportionalVac = Math.min(12, monthsBetween(lastAnniv, last) + 1);

  const lines: RescissionLine[] = [];

  // Saldo de salário (dias trabalhados no mês)
  const daysInMonth = new Date(last.getFullYear(), last.getMonth() + 1, 0).getDate();
  const saldoSalario = round((remun / daysInMonth) * last.getDate());
  lines.push({ key: "saldo_salario", label: `Saldo de salário (${last.getDate()}/${daysInMonth} dias)`, value: saldoSalario });

  // Aviso prévio
  let avisoValor = 0;
  const direitoAviso = ["sem_justa_causa", "rescisao_indireta", "acordo"].includes(terminationType);
  if (direitoAviso && noticeType === "indenizado") {
    avisoValor = round((remun / 30) * noticeDays);
    if (terminationType === "acordo") avisoValor = round(avisoValor / 2);
    lines.push({ key: "aviso_indenizado", label: `Aviso prévio indenizado (${noticeDays}d${terminationType === "acordo" ? " - 50%" : ""})`, value: avisoValor });
  }

  // Férias vencidas + 1/3
  if (vacationDaysPending > 0) {
    const fv = round((remun / 30) * vacationDaysPending);
    const tv = round(fv / 3);
    lines.push({ key: "ferias_vencidas", label: `Férias vencidas (${vacationDaysPending}d)`, value: fv });
    lines.push({ key: "ferias_vencidas_terco", label: "1/3 sobre férias vencidas", value: tv });
  }

  // Férias proporcionais (não tem direito em justa causa)
  if (terminationType !== "justa_causa") {
    const fp = round(((remun / 12) * monthsProportionalVac));
    const tp = round(fp / 3);
    lines.push({ key: "ferias_prop", label: `Férias proporcionais (${monthsProportionalVac}/12)`, value: fp });
    lines.push({ key: "ferias_prop_terco", label: "1/3 sobre férias proporcionais", value: tp });
  }

  // 13º proporcional (não tem em justa causa)
  if (terminationType !== "justa_causa") {
    const dec = round((remun / 12) * monthsCurrent13);
    lines.push({ key: "decimo_terceiro", label: `13º proporcional (${monthsCurrent13}/12)`, value: dec });
  }

  // Adiantamento de férias já recebido
  if (hadVacationAdvance) {
    lines.push({ key: "desc_adiant_ferias", label: "(-) Adiantamento de férias", value: -round(remun / 3) });
  }

  // INSS sobre saldo + 13º (férias indenizadas não têm INSS)
  const baseINSS = saldoSalario + (lines.find(l => l.key === "decimo_terceiro")?.value || 0);
  const inss = calcINSS(baseINSS);
  if (inss > 0) lines.push({ key: "inss", label: "(-) INSS", value: -inss });

  // IRRF sobre saldo + 13º - INSS (simplificado)
  const baseIRRF = baseINSS - inss;
  const irrf = calcIRRF(baseIRRF, dependents);
  if (irrf > 0) lines.push({ key: "irrf", label: "(-) IRRF", value: -irrf });

  // FGTS: 8% sobre saldo + 13º + aviso indenizado (depósito do empregador, não entra no líquido)
  const fgtsDeposit = round(0.08 * (saldoSalario + (lines.find(l => l.key === "decimo_terceiro")?.value || 0) + avisoValor));

  // Multa FGTS
  let fgtsPenalty = 0;
  const totalFgtsBase = fgtsBalance + fgtsDeposit;
  if (terminationType === "sem_justa_causa" || terminationType === "rescisao_indireta") {
    fgtsPenalty = round(totalFgtsBase * 0.4);
  } else if (terminationType === "acordo") {
    fgtsPenalty = round(totalFgtsBase * 0.2);
  }

  const gross = lines.filter(l => l.value > 0).reduce((s, l) => s + l.value, 0);
  const deductions = -lines.filter(l => l.value < 0).reduce((s, l) => s + l.value, 0);
  const net = round(gross - deductions);

  return {
    lines,
    gross: round(gross),
    deductions: round(deductions),
    net,
    fgtsDeposit,
    fgtsPenalty,
    inssTotal: inss,
    irrfTotal: irrf,
  };
}

export const TERMINATION_TYPE_LABELS: Record<TerminationType, string> = {
  sem_justa_causa: "Sem justa causa (empresa)",
  pedido_demissao: "Pedido de demissão",
  acordo: "Acordo (484-A)",
  justa_causa: "Justa causa",
  termino_contrato: "Término de contrato",
  termino_experiencia: "Término de experiência",
  rescisao_indireta: "Rescisão indireta",
};

export const NOTICE_TYPE_LABELS: Record<NoticeType, string> = {
  trabalhado: "Trabalhado",
  indenizado: "Indenizado",
  dispensado: "Dispensado",
  nao_aplica: "Não se aplica",
};
