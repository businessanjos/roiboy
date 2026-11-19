/** Tela de descanso das TVs: regras puras de sequência e textos. */
export const REST_LOGO_MS = 30_000;
export const REST_PHOTO_MS = 12_000;
export const REST_PHOTOS_PER_CYCLE = 3;
export const REST_MESSAGE_MS = 15_000;
export const REST_FADE_MS = 1_500;
export const REST_SHIFT_MS = 120_000;

export type RestStep = { kind: "logo" } | { kind: "photo"; index: number };

/** Passo seguinte: logo → 3 fotos (seguindo de onde parou) → logo. Sem fotos, fica no logo. */
export function nextRestStep(step: RestStep, photoCount: number, shownInCycle: number): { step: RestStep; shownInCycle: number } {
  if (photoCount === 0) return { step: { kind: "logo" }, shownInCycle: 0 };
  if (step.kind === "logo") return { step: { kind: "photo", index: (lastIndex.value + 1) % photoCount }, shownInCycle: 1 };
  lastIndex.value = step.index;
  if (shownInCycle >= REST_PHOTOS_PER_CYCLE) return { step: { kind: "logo" }, shownInCycle: 0 };
  return { step: { kind: "photo", index: (step.index + 1) % photoCount }, shownInCycle: shownInCycle + 1 };
}
const lastIndex = { value: -1 };
export function resetRestSequence() { lastIndex.value = -1; }

export function restStepDuration(step: RestStep) {
  return step.kind === "logo" ? REST_LOGO_MS : REST_PHOTO_MS;
}

export interface RestMessage { text: string; active: boolean }
export function activeRestMessages(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((m: any) => (typeof m === "string" ? { text: m, active: true } : m))
    .filter((m: any) => m && m.active !== false && typeof m.text === "string" && m.text.trim())
    .map((m: any) => m.text.trim());
}

/** "quinta-feira, 19 de novembro" no fuso de Brasília. */
export function restDateLabel(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(d);
}
export function restClockLabel(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(d);
}

/** Deslocamento anti-marcação: alterna entre posições a poucos pixels do centro. */
const SHIFTS: Array<[number, number]> = [[0, 0], [14, -10], [-12, 8], [10, 12], [-14, -8], [6, -14]];
export function restShift(tick: number): [number, number] {
  return SHIFTS[((tick % SHIFTS.length) + SHIFTS.length) % SHIFTS.length];
}

export interface RestWindow { days: number[]; start: string; end: string }
