/**
 * Última leitura da carteira guardada no navegador, por pessoa: a aba Assinaturas abre
 * na hora com ela e atualiza por trás. Guarda só o que a tela já mostra (clínica, vendedor, valores).
 */
import type { PayPortfolio } from "@/lib/sales/payPortfolio";

const PREFIX = "roy:pay-portfolio:v1:";
/** Depois disso a leitura guardada é descartada e a tela lê do zero. */
export const PORTFOLIO_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const store = (): Store | null => { try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; } };

export function readPortfolioCache(userId: string | null | undefined, now = Date.now(), storage: Store | null = store()): { data: PayPortfolio; at: number } | null {
  if (!userId || !storage) return null;
  try {
    const raw = storage.getItem(PREFIX + userId);
    if (!raw) return null;
    const data = JSON.parse(raw) as PayPortfolio;
    const at = Date.parse(data?.generatedAt);
    if (!Array.isArray(data?.clinics) || !Number.isFinite(at) || now - at > PORTFOLIO_CACHE_MAX_AGE_MS || at > now + 60_000) {
      storage.removeItem(PREFIX + userId);
      return null;
    }
    return { data, at };
  } catch {
    return null;
  }
}

export function writePortfolioCache(userId: string | null | undefined, data: PayPortfolio, storage: Store | null = store()) {
  if (!userId || !storage) return;
  try { storage.setItem(PREFIX + userId, JSON.stringify(data)); } catch { /* sem espaço: segue sem guardar */ }
}
