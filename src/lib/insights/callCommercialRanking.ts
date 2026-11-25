interface CallCommercialSeller {
  name: string;
  count?: number;
  salesMonth?: number;
}

/** Display-only ordering; never sort the shared aggregated data in place. */
export function rankCallCommercialSellers<T extends CallCommercialSeller>(
  sellers: readonly T[],
  showSales: boolean,
): T[] {
  return [...sellers].sort((a, b) => {
    const salesDifference = showSales ? (b.salesMonth ?? 0) - (a.salesMonth ?? 0) : 0;
    return salesDifference || (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name, 'pt-BR');
  });
}