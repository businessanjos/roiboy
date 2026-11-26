import { useCompany } from '@/contexts/CompanyContext';
import { filterVisiblePeople } from '@/lib/peopleVisibility';
import { companyRankingRows, type RankingPoint } from '@/lib/insights/companyRanking';
import type { AppearanceConfig, FormatType } from '../visual-builder/types';
import { ConfigurableRanking } from './ConfigurableRanking';
import { useTvMode } from '../TvModeContext';
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
  const visibleData = filterVisiblePeople(data);
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
          const total = rows.reduce((sum, row) => sum + row.value, 0);
          return (
            <section key={id} aria-label={`Ranking ${name}`} className={`flex min-h-0 min-w-0 flex-col border-border ${index > 0 ? 'company-ranking-secondary' : 'company-ranking-primary'}`}>
              <header className="mb-3 flex shrink-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-1 border-b border-border pb-3">
                <h3 className="text-base font-semibold text-foreground" style={tv.tv ? { fontSize: Math.round(20 * tv.scale), lineHeight: 1.2 } : undefined}>{name}</h3>
                <span style={tv.tv ? { fontSize: Math.round(22 * tv.scale), lineHeight: 1.2, fontWeight: 700 } : undefined} className={`text-sm font-semibold tabular-nums text-foreground ${rankingProps.privacy?.blurNumbers ? 'blur-md select-none' : ''}`}>{format(total)}</span>
              </header>
              <div className={`min-h-0 flex-1 ${tv.tv ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                {rows.length ? <ConfigurableRanking data={rows} {...rankingProps} compact /> : (
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