/** Plano anual lista as parcelas do ciclo 1 ao último; mensal mostra a cobrança mais recente primeiro. */
export function orderPayInvoices<T extends { cycle: number | null }>(invoices: T[], annual: boolean): T[] {
  return [...invoices].sort((a, b) =>
    annual
      ? (a.cycle ?? Number.MAX_SAFE_INTEGER) - (b.cycle ?? Number.MAX_SAFE_INTEGER)
      : (b.cycle ?? 0) - (a.cycle ?? 0),
  );
}
