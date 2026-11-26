/**
 * Regras de troca de nome e exclusão das Áreas de Atuação.
 *
 * A área fica salva nas fichas pelo nome (lista separada por vírgulas), então
 * trocar ou excluir precisa atualizar as fichas junto — isso é feito no banco
 * (`rename_practice_area`, `delete_practice_area`, `move_practice_area_label`).
 * Aqui ficam só as checagens que a tela faz antes de confirmar.
 */
import { practiceAreaKey } from "@/lib/dashboard/clientPracticeArea";

export interface AreaUsage {
  clients: number;
  leads: number;
}

export const NO_USAGE: AreaUsage = { clients: 0, leads: 0 };

export type DeleteMode = "move" | "remove";

export function cleanAreaName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Mensagem de erro do nome, ou null quando pode ser usado. */
export function validateAreaName(raw: string): string | null {
  const name = cleanAreaName(raw);
  if (!name) return "Informe um nome";
  // A vírgula separa as áreas dentro da ficha; um nome com vírgula viraria duas áreas.
  if (name.includes(",")) return "O nome da área não pode ter vírgula";
  return null;
}

/** Outra área que já usa esse nome (ignorando maiúsculas e acentos). */
export function findNameConflict<T extends { id: string; label: string }>(
  areas: T[],
  currentId: string | null,
  newLabel: string,
): T | null {
  const key = practiceAreaKey(cleanAreaName(newLabel));
  if (!key) return null;
  return areas.find((a) => a.id !== currentId && practiceAreaKey(a.label) === key) ?? null;
}

export function usageTotal(usage: AreaUsage): number {
  return usage.clients + usage.leads;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "12 fichas de clientes e 3 leads" — ou null quando ninguém usa. */
export function describeUsage(usage: AreaUsage): string | null {
  const parts: string[] = [];
  if (usage.clients > 0) parts.push(plural(usage.clients, "ficha de cliente", "fichas de clientes"));
  if (usage.leads > 0) parts.push(plural(usage.leads, "lead", "leads"));
  return parts.length ? parts.join(" e ") : null;
}

/**
 * Área em uso só pode ser excluída depois de escolher o destino das fichas
 * (outra área) ou de confirmar que ela deve sair das fichas.
 */
export function canConfirmDelete(
  usage: AreaUsage,
  mode: DeleteMode | null,
  moveToId: string | null,
): boolean {
  if (usageTotal(usage) === 0) return true;
  if (mode === "move") return !!moveToId;
  return mode === "remove";
}
