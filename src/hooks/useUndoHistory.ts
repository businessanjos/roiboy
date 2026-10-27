import { useState } from "react";

/**
 * Histórico simples de desfazer para estados serializáveis (JSON).
 * `snapshot` guarda o estado ANTES de uma alteração (ignora estados idênticos consecutivos).
 * `pop` devolve o último estado salvo e o remove da pilha.
 */
export function useUndoHistory<T>(max = 60) {
  const [history, setHistory] = useState<T[]>([]);

  const snapshot = (current: T) =>
    setHistory((h) => {
      const last = h[h.length - 1];
      if (last && JSON.stringify(last) === JSON.stringify(current)) return h;
      const next = [...h, JSON.parse(JSON.stringify(current))];
      return next.length > max ? next.slice(next.length - max) : next;
    });

  const pop = (): T | null => {
    if (history.length === 0) return null;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    return prev;
  };

  const clear = () => setHistory([]);

  return { canUndo: history.length > 0, snapshot, pop, clear };
}
