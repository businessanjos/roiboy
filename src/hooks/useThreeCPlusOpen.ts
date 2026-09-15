import { useSyncExternalStore } from "react";

/**
 * Estado global simples: indica se o painel do Discador 3C está aberto.
 * Usado pelas fichas (lead/negócio) para desligar o modo modal e permitir
 * cliques dentro do discador enquanto a ficha continua aberta atrás.
 */
let open = false;
const listeners = new Set<() => void>();

export function setThreeCPlusOpen(value: boolean) {
  if (open === value) return;
  open = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useThreeCPlusOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}
