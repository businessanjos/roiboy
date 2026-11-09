/** Quadro "Em andamento" dos Processos Eternum: em que fase/etapa está cada cliente e cada encontro.
 * Só usa campos que já existem (etapa do onboarding da ficha, data do evento). Nada é inventado. */
import { addDays, daysBetween, isEncontroOnline, isEncontroPresencial, ONLINE, spDate } from "@/lib/csToday";

const HIDDEN_CONSULTANT_FILTER_NAMES = new Set(["felipe tester", "jessica campos"]);

/** Controla apenas as opções do filtro; não altera cadastro, função ou clientes da pessoa. */
export function showInCsConsultantFilter(name: string): boolean {
  return !HIDDEN_CONSULTANT_FILTER_NAMES.has(name.trim().toLocaleLowerCase("pt-BR"));
}

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

export interface HubStage { id: string; name: string; display_order: number | null }

/** Índice (na ordem das etapas do processo) em que a cliente está pela etapa do Onboarding Hub. -1 = sem correspondência. */
export function stageStepIndex(allKeys: string[], stage: HubStage | null | undefined): number {
  const k = stepOfStage(stage?.name);
  return k ? allKeys.indexOf(k) : -1;
}

/** Etapas anteriores à etapa do Onboarding Hub contam como feitas (a consultora já passou por elas). */
export function impliedDoneKeys(allKeys: string[], stage: HubStage | null | undefined): Set<string> {
  const idx = stageStepIndex(allKeys, stage);
  return new Set(idx > 0 ? allKeys.slice(0, idx) : []);
}

/** Próxima etapa do Onboarding Hub após marcar etapas nos Processos. Nunca volta a cliente para trás.
 * Retorna o id da etapa para onde avançar, ou null se nada muda. */
export function stageToAdvance(allKeys: string[], done: Set<string>, stages: HubStage[], current: HubStage | null | undefined): string | null {
  const next = allKeys.findIndex((k) => !done.has(k));
  const reach = next === -1 ? allKeys.length - 1 : next;
  const curIdx = stageStepIndex(allKeys, current);
  const curOrder = current?.display_order ?? -1;
  let best: HubStage | null = null, bestIdx = -1;
  for (const s of stages) {
    const i = stageStepIndex(allKeys, s);
    if (i < 0 || i > reach || i <= curIdx || i <= bestIdx) continue;
    if (current && curIdx < 0 && (s.display_order ?? -1) <= curOrder) continue; // etapa atual fora do mapa: só avança na ordem do Hub
    best = s; bestIdx = i;
  }
  return best && best.id !== current?.id ? best.id : null;
}
