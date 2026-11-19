/** Regras puras do fluxo "Adicionar TV" (contrato com o agente das TVs). */
export type FoundTv = { ip: string; mac: string; name: string; model: string; brand: "lg" | "android"; known: boolean; slot: number | null };
export type PairError = "recusado" | "tempo_esgotado" | "inacessivel" | "outro";

export const AGENT_OFFLINE_MS = 2 * 60_000;
export const LG_PAIR_SECONDS = 90;
export const ANDROID_PAIR_SECONDS = 300;

/** Agente offline quando o último sync de qualquer TV foi há mais de 2 min. */
export function agentIsOffline(status: { last_seen?: string | null }[], now = Date.now()): boolean {
  const last = Math.max(0, ...status.map((s) => (s.last_seen ? new Date(s.last_seen).getTime() : 0)));
  return !last || now - last > AGENT_OFFLINE_MS;
}

/** Menor slot livre entre 1 e 20 (null se cheio). */
export function nextFreeSlot(used: number[]): number | null {
  for (let i = 1; i <= 20; i++) if (!used.includes(i)) return i;
  return null;
}

function parse(result: unknown): any {
  if (typeof result !== "string") return result ?? null;
  try { return JSON.parse(result); } catch { return result; }
}

/** Lê a lista de TVs do resultado do comando "discover". */
export function parseDiscover(result: unknown): FoundTv[] {
  const r = parse(result);
  const list = Array.isArray(r?.devices) ? r.devices : [];
  return list.filter((d: any) => d && typeof d.ip === "string").map((d: any) => ({
    ip: d.ip, mac: String(d.mac ?? ""), name: String(d.name || d.model || d.ip), model: String(d.model ?? ""),
    brand: d.brand === "android" ? "android" : "lg", known: !!d.known, slot: Number.isInteger(d.slot) ? d.slot : null,
  }));
}

/** Traduz o erro do comando "pair" para um dos três casos conhecidos. */
export function pairErrorKind(result: unknown): PairError {
  const r = parse(result);
  const t = String(typeof r === "object" && r ? r.error ?? "" : r ?? "").toLowerCase();
  if (t.includes("recusad")) return "recusado";
  if (t.includes("tempo") || t.includes("timeout") || t.includes("respondeu")) return "tempo_esgotado";
  if (t.includes("inacess")) return "inacessivel";
  return "outro";
}

export const PAIR_ERROR_TEXT: Record<PairError, string> = {
  recusado: "A TV recusou a conexão. Tente de novo e selecione ACEITAR na janela.",
  tempo_esgotado: "Ninguém respondeu na TV a tempo. Fique na frente da TV e tente de novo.",
  inacessivel: "Não conseguimos falar com a TV. Ela desligou ou saiu do Wi-Fi?",
  outro: "Não deu para conectar a TV. Tente de novo.",
};

/** Código Android: 6 caracteres, maiúsculos, sem espaços. */
export function normalizePairCode(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}
