import { useCompany } from '@/contexts/CompanyContext';
import { filterVisiblePeople } from '@/lib/peopleVisibility';
import { companyRankingRows, type RankingPoint } from '@/lib/insights/companyRanking';
import type { AppearanceConfig, FormatType } from '../visual-builder/types';
import { ConfigurableRanking } from './ConfigurableRanking';
import { useTvMode } from '../TvModeContext';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { supabase } from '@/integrations/supabase/client';
import { rankingRecurringRows, rankingRecurringValue } from '@/lib/insights/rankingRecurring';
import type { PayPortfolio } from '@/lib/sales/payPortfolio';
import { useInsightsFilters } from '@/hooks/useInsightsFilters';
import './CompanyRanking.css';

interface Props {
  data: RankingPoint[];
  companyIds: string[];
  formatting: { type: FormatType; decimals: number };
  appearance?: AppearanceConfig;
  dimensionLabel?: string;
  measureLabel?: string;
  hiddenProducts?: string[];
  privacy?: { showNames: boolean; showPhotos: boolean; blurNumbers: boolean };
}

export function CompanyRanking({ data, companyIds, ...rankingProps }: Props) {
  const { companies, loading } = useCompany();
  const tv = useTvMode();
  const { filters } = useInsightsFilters();
  const visibleData = filterVisiblePeople(data);
  const { currentUser } = useCurrentUser();
  const hasRecurring = visibleData.some(row => row.recurringDealIds?.length);
  // Read only the already-stored, RLS-scoped portfolio. Opening a TV never triggers a provider sweep.
  const stored = useQuery({
    queryKey: ['pay-portfolio-stored', currentUser?.account_id, currentUser?.id],
    enabled: Boolean(currentUser && hasRecurring && rankingProps.formatting.type === 'currency'),
    staleTime: 60 * 1000,
    refetchInterval: tv.tv ? 15 * 60 * 1000 : false,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async (): Promise<PayPortfolio | null> => {
      const { data: result, error } = await supabase.from('pay_portfolio_snapshots').select('data').maybeSingle();
      if (error) throw error;
      const snapshot = result?.data as PayPortfolio | undefined;
      return snapshot && Array.isArray(snapshot.clinics) ? snapshot : null;
    },
  });
  const unlinked = visibleData.filter(row => !row.companyId);
  const unlinkedValue = unlinked.reduce((total, row) => total + row.value, 0);
  const format = (value: number) => value.toLocaleString('pt-BR', {
    ...(rankingProps.formatting.type === 'currency' ? { style: 'currency', currency: 'BRL' } : {}),
    minimumFractionDigits: rankingProps.formatting.decimals,
    maximumFractionDigits: rankingProps.formatting.decimals,
  });

  return (
    <div className={`company-ranking flex h-full min-h-0 flex-col gap-3 ${tv.tv ? 'overflow-hidden' : ''}`}>
      <div className="company-ranking-grid grid min-h-0 flex-1">
        {companyIds.map((id, index) => {
          const company = companies.find(item => item.id === id);
          const name = company?.trade_name || company?.legal_name || (loading ? 'Carregando empresa…' : 'Empresa indisponível');
          const rows = companyRankingRows(visibleData, id);
          const showRecurring = rankingProps.formatting.type === 'currency' && rows.some(row => row.recurringDealIds?.length);
          const canIncludePreviousSellers = filters.productId === 'all' && (!filters.pipelineId || filters.pipelineId === 'all') && filters.stageId === 'all' && !filters.globalFieldFilter;
          const displayRows = showRecurring
            ? canIncludePreviousSellers
              ? rankingRecurringRows(rows, stored.data, filters.endDate, filters.userId)
              : rows.map(row => ({ ...row, recurringValue: rankingRecurringValue(row, stored.data, filters.endDate) }))
            : rows;
          const total = rows.reduce((sum, row) => sum + row.value, 0);
          const recurringTotal = showRecurring
            ? rankingRecurringValue({ sellerIds: displayRows.flatMap(row => row.sellerIds ?? []) }, stored.data, filters.endDate)
            : null;
          return (
            <section key={id} aria-label={`Ranking ${name}`} className={`flex min-h-0 min-w-0 flex-col border-border ${index > 0 ? 'company-ranking-secondary' : 'company-ranking-primary'}`}>
              <header className="mx-auto mb-3 flex w-full max-w-[640px] shrink-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-1 border-b border-border pb-3">
                <h3 className="text-base font-semibold text-foreground" style={tv.tv ? { fontSize: Math.round(20 * tv.scale), lineHeight: 1.2 } : undefined}>{name}</h3>
                <div className={`flex min-w-0 flex-col items-end gap-1 ${rankingProps.privacy?.blurNumbers ? 'blur-md select-none' : ''}`}>
                  <span style={tv.tv ? { fontSize: Math.round(22 * tv.scale), lineHeight: 1.2, fontWeight: 700 } : undefined} className="text-sm font-semibold tabular-nums text-foreground">{format(total)}</span>
                  {showRecurring && (
                    <span className="text-right text-xs font-normal tabular-nums text-muted-foreground" style={tv.tv ? { fontSize: Math.round(14 * tv.scale), lineHeight: 1.2 } : undefined}>
                      Recorrência recebida: {recurringTotal != null ? format(recurringTotal) : stored.isLoading ? 'Carregando…' : 'Indisponível'}
                    </span>
                  )}
                </div>
              </header>
              <div className={`min-h-0 flex-1 ${tv.tv ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                {rows.length ? <ConfigurableRanking data={displayRows} {...rankingProps} compact showRecurring={showRecurring} recurringLoading={stored.isLoading} /> : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sem vendas neste período</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {unlinked.length > 0 && (
        <p className={`shrink-0 border-t border-border pt-2 text-xs text-muted-foreground ${rankingProps.privacy?.blurNumbers ? 'blur-md select-none' : ''}`}>
          Sem empresa vinculada: {unlinked.reduce((total, row) => total + (row.count ?? 0), 0)} vendas · {format(unlinkedValue)}
        </p>
      )}
    </div>
  );
}