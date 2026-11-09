/** Quadro "Em andamento" dos Processos Eternum: em que fase/etapa está cada cliente e cada encontro.
 * Só usa campos que já existem (etapa do onboarding da ficha, data do evento). Nada é inventado. */
import { addDays, daysBetween, isEncontroOnline, isEncontroPresencial, ONLINE, spDate } from "@/lib/csToday";

/** Etapa do Onboarding Hub (client_stages.name) → etapa do processo de Onboarding ("fase-etapa").
 * Etapas sem correspondência clara retornam null e aparecem em "Sem fase definida". */
const STAGE_MAP: [RegExp, string][] = [
  [/boas.?vindas.*consultor/i, "0-0"],
  [/libera[cç][aã]o.*acesso.*metodologia/i, "0-1"],
  [/grupo.*whats/i, "0-2"],
  [/cadastro empresarial/i, "1-0"],
  [/agendado onboarding$/i, "2-0"],
  [/onboarding com consultor/i, "2-1"],
  [/plano de a[cç][aã]o/i, "2-2"],
];
export function stepOfStage(stageName: string | null | undefined): string | null {
  if (!stageName) return null;
  const n = stageName.trim();
  for (const [re, k] of STAGE_MAP) if (re.test(n)) return k;
  return null;
}

export interface BoardCard {
  id: string;
  kind: "client" | "event";
  name: string;
  avatar?: string | null;
  dateLabel?: string;
  stepKey: string | null; // null = sem fase definida / aguardando início
  stageLabel?: string;   // nome original da etapa na ficha
  since?: string | null;  // AAAA-MM-DD desde quando está na etapa
  ownerId?: string | null;
  waiting?: boolean;
  eventDay?: string;
}

/** Etapa atual de um encontro pela data real (fuso SP). null = fora da janela do quadro. */
export function eventStep(e: { title: string; modality: string | null; event_type?: string | null; scheduled_at: string }, today = spDate()): { processIndex: 1 | 2; stepKey: string; since: string } | null {
  const online = isEncontroOnline(e), pres = !online && isEncontroPresencial(e);
  if (!online && !pres) return null;
  const day = spDate(new Date(e.scheduled_at));
  const diff = daysBetween(today, day); // dias até o evento
  if (online) {
    if (diff > 15 || diff < -7) return null;
    const passed = ONLINE.filter(([off]) => addDays(day, off) <= today);
    if (!passed.length) return { processIndex: 1, stepKey: "0-0", since: today };
    const [off, , k] = passed[passed.length - 1];
    return { processIndex: 1, stepKey: k, since: addDays(day, off) };
  }
  if (diff > 60 || diff < -7) return null;
  if (diff > 0) return { processIndex: 2, stepKey: "0-0", since: addDays(day, -60) };
  if (diff === 0) return { processIndex: 2, stepKey: "1-0", since: day };
  return { processIndex: 2, stepKey: "2-0", since: addDays(day, 1) };
}

export function sinceLabel(since: string | null | undefined, today = spDate()) {
  if (!since) return "";
  const d = daysBetween(since, today);
  return d <= 0 ? "desde hoje" : d === 1 ? "há 1 dia" : `há ${d} dias`;
}
