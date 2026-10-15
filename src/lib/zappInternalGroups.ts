// Grupos internos da equipe (não são atendimento de cliente) não entram na Fila.
const INTERNAL_PATTERNS: RegExp[] = [
  /bugs?/i,
  /^\s*(EC|EM|EP)\s*\|/i,
  /^\s*EP\s+club/i,
  /^\s*financeiro\b/i,
  /^\s*tech\s+supp?ort/i,
  /^\s*cancelamentos\s*-/i,
  /^\s*congelamentos\s*-/i,
  /^\s*cl[ií]nica\s+ryka\s*$/i,
];

export function isInternalGroup(name: string | null | undefined, isGroup: boolean, isPinned?: boolean): boolean {
  if (!isGroup) return false;
  if (isPinned) return true;
  const n = name || "";
  return INTERNAL_PATTERNS.some((r) => r.test(n));
}

// Sinal de espera (ponto laranja / "Aguardando").
// Em conversa de cliente vale a régua de atendimento: "pending" marca espera.
// Nos nossos grupos a régua não se aplica: só o laranja de mensagem realmente
// não lida aparece, e ele some assim que a pessoa lê.
export function showsWaitIndicator(opts: {
  internal: boolean;
  status: string;
  unreadCount: number;
}): boolean {
  if (opts.internal) return opts.unreadCount > 0;
  return opts.status === "pending";
}
