// Cálculo da janela de apuração de um SPIFF de roleta custom (vendas por janela).
// Extraído para ser reutilizado pelo painel de giros e pela fila de aprovação,
// garantindo que gestor e vendedor vejam exatamente as mesmas vendas.

const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const getLastBusinessDayOfMonth = (ref: Date): Date => {
  const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  while (last.getDay() === 0 || last.getDay() === 6) {
    last.setDate(last.getDate() - 1);
  }
  return last;
};

export type SpiffWindow = {
  start: Date;
  end: Date;
  label: string;
};

/** Janela vigente do SPIFF numa data de referência (padrão: agora). */
export function getSpiffWindow(spiff: any, reference: Date = new Date()): SpiffWindow {
  const windowType: string | null = spiff?.trigger_window_type || null;
  const windowDays = Number(spiff?.trigger_window_days || 7);
  const weekStartDay: number | null =
    spiff?.trigger_week_start_day !== null && spiff?.trigger_week_start_day !== undefined
      ? Number(spiff.trigger_week_start_day)
      : null;

  let start: Date;
  let end: Date;

  if (windowType === "last-business-day") {
    const lbd = getLastBusinessDayOfMonth(reference);
    start = new Date(lbd);
    start.setHours(0, 0, 0, 0);
    end = new Date(lbd);
    end.setHours(23, 59, 59, 999);
  } else if (weekStartDay !== null) {
    const diff = (reference.getDay() - weekStartDay + 7) % 7;
    start = new Date(reference);
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else {
    start = new Date(reference);
    start.setDate(start.getDate() - windowDays + 1);
    start.setHours(0, 0, 0, 0);
    end = new Date(reference);
    end.setHours(23, 59, 59, 999);
  }

  if (spiff?.end_date) {
    const campaignEnd = new Date(spiff.end_date);
    campaignEnd.setHours(23, 59, 59, 999);
    if (end > campaignEnd) end = campaignEnd;
  }

  const label =
    windowType === "last-business-day"
      ? `Último dia útil (${start.toLocaleDateString("pt-BR")})`
      : weekStartDay !== null
        ? `Semana ${dayNames[weekStartDay]}→${dayNames[(weekStartDay + 6) % 7]} (${start.toLocaleDateString("pt-BR")} a ${end.toLocaleDateString("pt-BR")})`
        : `Últimos ${windowDays}d (${start.toLocaleDateString("pt-BR")} a ${end.toLocaleDateString("pt-BR")})`;

  return { start, end, label };
}

export const spiffDayNames = dayNames;
