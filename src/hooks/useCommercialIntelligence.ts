import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { isCommercialMql, type CommercialRow } from '@/components/marketing/commercialIntelligenceData';

const channels: Record<string, string> = { organico: 'Orgânico', trafego_pago: 'Tráfego Pago', indicacao: 'Indicação', eventos: 'Eventos', carteira_esteira: 'Carteira/Esteira' };

export function useCommercialIntelligence(startDate: Date, endDate: Date) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  return useQuery({
    queryKey: ['commercial-intelligence', accountId, currentUser?.id, startDate.toISOString(), endDate.toISOString()],
    enabled: !!accountId, staleTime: 5 * 60000, gcTime: 30 * 60000, placeholderData: (prev) => prev,
    queryFn: async (): Promise<CommercialRow[]> => {
      if (!accountId) return [];
      const { data: fields, error: fieldError } = await supabase.from('custom_fields').select('id,name,options').eq('account_id', accountId).in('name', ['MQL', 'Canal de Venda', 'Canal', 'Origem da Venda']);
      if (fieldError) throw fieldError;
      const select = 'id,lead_id,contact_name,title,status,value,created_at,source,lead:leads(full_name,instagram,mql,canal)';
      const base = () => supabase.from('deals').select(select, { count: 'exact' }).eq('account_id', accountId).is('deleted_at', null).gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()).order('id');
      const PAGE = 1000;
      const first = await base().range(0, PAGE - 1);
      if (first.error) throw first.error;
      const deals = [...(first.data ?? [])];
      const total = first.count ?? deals.length;
      if (total > PAGE) {
        const pages = await Promise.all(Array.from({ length: Math.ceil(total / PAGE) - 1 }, (_, i) => base().range((i + 1) * PAGE, (i + 2) * PAGE - 1)));
        for (const page of pages) { if (page.error) throw page.error; deals.push(...(page.data ?? [])); }
      }
      const values = new Map<string, Map<string, string[]>>();
      const fieldById = new Map((fields ?? []).map(f => [f.id, f]));
      const fieldIds = [...fieldById.keys()];
      const chunks: string[][] = [];
      if (fieldIds.length) for (let i = 0; i < deals.length; i += 150) chunks.push(deals.slice(i, i + 150).map(d => d.id));
      const results = [];
      for (let i = 0; i < chunks.length; i += 6) {
        results.push(...await Promise.all(chunks.slice(i, i + 6).map(ids => supabase.from('deal_field_values').select('deal_id,field_id,value_text,value_json').in('deal_id', ids).in('field_id', fieldIds))));
      }
      for (const { data, error } of results) {
        if (error) throw error;
        for (const value of data ?? []) {
          const field = fieldById.get(value.field_id);
          if (!field) continue;
          const options = Array.isArray(field.options) ? field.options : [];
          const raw = Array.isArray(value.value_json) ? value.value_json.map(String) : value.value_text ? [value.value_text] : [];
          const labels = raw.map(v => {
            const option = options.find(o => typeof o === 'object' && o !== null && 'value' in o && o.value === v);
            return typeof option === 'object' && option !== null && 'label' in option ? String(option.label) : v;
          });
          const map = values.get(value.deal_id) ?? new Map<string, string[]>();
          map.set(field.name, labels); values.set(value.deal_id, map);
        }
      }
      return deals.map(deal => {
        const fields = values.get(deal.id);
        const channel = fields?.get('Canal de Venda')?.[0] || fields?.get('Canal')?.[0] || deal.lead?.canal;
        return {
          id: deal.id, leadId: deal.lead_id, name: deal.lead?.full_name || deal.contact_name || deal.title,
          instagram: deal.lead?.instagram ?? null,
          channel: channel ? channels[channel] ?? channel : 'Sem canal',
          origins: fields?.get('Origem da Venda') ?? [],
          mql: isCommercialMql(fields?.has('MQL') ? fields.get('MQL')?.[0] : deal.lead?.mql),
          status: deal.status ?? 'open', value: Number(deal.value ?? 0), createdAt: deal.created_at,
        };
      });
    },
  });
}