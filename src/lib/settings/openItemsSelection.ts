/**
 * Seleção de pendências que o gestor decide transferir.
 * Guardada no navegador para que a guia dedicada e a janela de inativação conversem.
 */

export interface ItemSelection {
  /** "all" = tudo; "except" = tudo menos os ids/títulos abaixo; "none" = nada. */
  mode: "all" | "except" | "none";
  /** Ids desmarcados individualmente. */
  excludedIds: string[];
  /** Blocos de título desmarcados inteiros (ex.: "Follow Up"). */
  excludedTitles: string[];
  /** Quantos registros ficam para transferir (calculado na guia). */
  selectedCount: number;
  /** Total em aberto no momento da conferência. */
  total: number;
  updatedAt: string;
}

const KEY = (userId: string, itemKey: string) => `roy:open-items-selection:${userId}:${itemKey}`;
export const SELECTION_CHANNEL = "roy-open-items-selection";

export const emptySelection = (total = 0): ItemSelection => ({
  mode: "all",
  excludedIds: [],
  excludedTitles: [],
  selectedCount: total,
  total,
  updatedAt: new Date().toISOString(),
});

export function readSelection(userId: string, itemKey: string): ItemSelection | null {
  try {
    const raw = localStorage.getItem(KEY(userId, itemKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ItemSelection;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      mode: parsed.mode === "except" || parsed.mode === "none" ? parsed.mode : "all",
      excludedIds: Array.isArray(parsed.excludedIds) ? parsed.excludedIds : [],
      excludedTitles: Array.isArray(parsed.excludedTitles) ? parsed.excludedTitles : [],
      selectedCount: Number(parsed.selectedCount) || 0,
      total: Number(parsed.total) || 0,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeSelection(userId: string, itemKey: string, selection: ItemSelection) {
  try {
    localStorage.setItem(KEY(userId, itemKey), JSON.stringify(selection));
  } catch {
    /* storage cheio: a guia continua funcionando, só não sincroniza */
  }
  try {
    const ch = new BroadcastChannel(SELECTION_CHANNEL);
    ch.postMessage({ userId, itemKey, selection });
    ch.close();
  } catch {
    /* navegador sem BroadcastChannel */
  }
}

export function clearSelection(userId: string, itemKey: string) {
  try {
    localStorage.removeItem(KEY(userId, itemKey));
  } catch { /* ignore */ }
}

/** Títulos genéricos de rotina de prospecção — não são trabalho real a repassar. */
const ROUTINE_PATTERNS = [
  "follow up",
  "followup",
  "ligacao nao atendida",
  "ligacao sem resposta",
  "nao atendeu",
  "primeiro contato",
  "sem resposta",
  "tentativa de contato",
  "retornar ligacao",
  "whatsapp enviado",
];

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function isRoutineTitle(title: string): boolean {
  const n = normalize(title);
  return ROUTINE_PATTERNS.some((p) => n.includes(p));
}

/** Converte a seleção no formato aceito pela edge function. */
export function selectionToPayload(selection: ItemSelection | null) {
  if (!selection || selection.mode === "all") return {};
  if (selection.mode === "none") return { mode: "only" as const, ids: [], exclude_titles: [] };
  return {
    mode: "except" as const,
    ids: selection.excludedIds,
    exclude_titles: selection.excludedTitles,
  };
}
