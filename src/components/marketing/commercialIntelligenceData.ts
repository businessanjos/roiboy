export interface CommercialRow {
  id: string; leadId: string | null; name: string; instagram: string | null;
  channel: string; origins: string[]; mql: boolean; status: string;
  value: number; createdAt: string;
}

export function isCommercialMql(value: string | null | undefined) {
  return ['sim_acima_30k', 'SIM - Acima de 30k', 'SIM - Lead Qualificado / +30K', 'opt_1'].includes(value ?? '');
}

export function commercialGroups(rows: CommercialRow[], dimension: 'channel' | 'origin') {
  const groups = new Map<string, { label: string; leads: number; mql: number; sales: number; revenue: number }>();
  for (const row of rows) {
    const labels = dimension === 'channel' ? [row.channel] : row.origins.length ? [...new Set(row.origins)] : ['Sem origem'];
    for (const label of labels) {
      const group = groups.get(label) ?? { label, leads: 0, mql: 0, sales: 0, revenue: 0 };
      group.leads++;
      if (row.mql) group.mql++;
      if (row.status === 'won') { group.sales++; group.revenue += row.value; }
      groups.set(label, group);
    }
  }
  return [...groups.values()].sort((a, b) => b.leads - a.leads);
}