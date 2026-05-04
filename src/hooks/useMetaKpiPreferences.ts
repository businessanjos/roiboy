import { useState, useEffect } from 'react';

export interface MetaKpi {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  format: 'number' | 'currency' | 'percentage' | 'decimal';
  category: 'performance' | 'engagement' | 'cost' | 'conversion';
}

export const ALL_META_KPIS: MetaKpi[] = [
  { id: 'impressions', label: 'Impressões', description: 'Total de vezes que os anúncios foram exibidos', icon: 'Eye', color: 'blue', format: 'number', category: 'performance' },
  { id: 'reach', label: 'Alcance', description: 'Número de pessoas únicas que viram os anúncios', icon: 'Users', color: 'blue', format: 'number', category: 'performance' },
  { id: 'frequency', label: 'Frequência', description: 'Média de vezes que cada pessoa viu os anúncios', icon: 'Repeat', color: 'blue', format: 'decimal', category: 'performance' },
  { id: 'clicks', label: 'Cliques', description: 'Total de cliques em links', icon: 'MousePointer', color: 'emerald', format: 'number', category: 'engagement' },
  { id: 'ctr', label: 'CTR', description: 'Taxa de cliques (Cliques/Impressões)', icon: 'TrendingUp', color: 'emerald', format: 'percentage', category: 'engagement' },
  { id: 'engagement_rate', label: 'Taxa de Engajamento', description: 'Taxa de interações com os anúncios', icon: 'Heart', color: 'emerald', format: 'percentage', category: 'engagement' },
  { id: 'post_engagement', label: 'Engajamento', description: 'Total de reações, comentários e compartilhamentos', icon: 'MessageCircle', color: 'emerald', format: 'number', category: 'engagement' },
  { id: 'video_views', label: 'Views de Vídeo', description: 'Total de visualizações de vídeos', icon: 'Play', color: 'emerald', format: 'number', category: 'engagement' },
  { id: 'video_thruplay', label: 'ThruPlays', description: 'Vídeos assistidos até o final ou 15s+', icon: 'PlayCircle', color: 'emerald', format: 'number', category: 'engagement' },
  { id: 'spend', label: 'Investimento', description: 'Total gasto no período', icon: 'DollarSign', color: 'amber', format: 'currency', category: 'cost' },
  { id: 'cpc', label: 'CPC', description: 'Custo por clique', icon: 'Wallet', color: 'amber', format: 'currency', category: 'cost' },
  { id: 'cpm', label: 'CPM', description: 'Custo por mil impressões', icon: 'Receipt', color: 'amber', format: 'currency', category: 'cost' },
  { id: 'cpp', label: 'CPP', description: 'Custo por mil pessoas alcançadas', icon: 'CreditCard', color: 'amber', format: 'currency', category: 'cost' },
  { id: 'cost_per_result', label: 'Custo por Resultado', description: 'Custo médio por conversão', icon: 'Calculator', color: 'amber', format: 'currency', category: 'cost' },
  { id: 'conversions', label: 'Conversões', description: 'Total de ações de conversão', icon: 'CheckCircle', color: 'purple', format: 'number', category: 'conversion' },
  { id: 'leads', label: 'Leads', description: 'Total de leads gerados', icon: 'UserPlus', color: 'purple', format: 'number', category: 'conversion' },
  { id: 'purchases', label: 'Compras', description: 'Total de compras realizadas', icon: 'ShoppingCart', color: 'purple', format: 'number', category: 'conversion' },
  { id: 'purchase_value', label: 'Valor de Compras', description: 'Valor total de compras', icon: 'Banknote', color: 'purple', format: 'currency', category: 'conversion' },
  { id: 'roas', label: 'ROAS', description: 'Retorno sobre investimento em anúncios', icon: 'TrendingUp', color: 'purple', format: 'decimal', category: 'conversion' },
  { id: 'landing_page_views', label: 'Views de Landing Page', description: 'Visualizações de páginas de destino', icon: 'Layout', color: 'purple', format: 'number', category: 'conversion' },
];

const DEFAULT_VISIBLE_KPIS = ALL_META_KPIS.map(k => k.id);
const STORAGE_KEY = 'meta-kpi-preferences';

export function useMetaKpiPreferences() {
  const [visibleKpis, setVisibleKpis] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        const allIds = ALL_META_KPIS.map(k => k.id);
        if (!allIds.every(id => parsed.includes(id))) {
          localStorage.removeItem(STORAGE_KEY);
          return DEFAULT_VISIBLE_KPIS;
        }
        return parsed;
      }
    } catch {}
    return DEFAULT_VISIBLE_KPIS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleKpis));
  }, [visibleKpis]);

  const toggleKpi = (id: string) => setVisibleKpis(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const resetToDefaults = () => setVisibleKpis(DEFAULT_VISIBLE_KPIS);
  const getVisibleKpiDetails = (): MetaKpi[] => visibleKpis.map(id => ALL_META_KPIS.find(k => k.id === id)).filter(Boolean) as MetaKpi[];

  return { visibleKpis, toggleKpi, resetToDefaults, getVisibleKpiDetails, allKpis: ALL_META_KPIS };
}
