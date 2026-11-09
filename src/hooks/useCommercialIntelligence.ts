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
    enabled: !!accountId, staleTime: 60000,
    queryFn: async (): Promise<CommercialRow[]> => {
      if (!accountId) return [];
      const { data: fields, error: fieldError } = await supabase.from('custom_fields').select('id,name,options').eq('account_id', accountId).in('name', ['MQL', 'Canal de Venda', 'Canal', 'Origem da Venda']);
      if (fieldError) throw fieldError;
      const deals = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('deals').select('id,lead_id,contact_name,title,status,value,created_at,source,lead:leads(full_name,instagram,mql,canal)').eq('account_id', accountId).is('deleted_at', null).gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString()).order('id').range(offset, offset + 499);
        if (error) throw error;
        deals.push(...(data ?? []));
        if ((data?.length ?? 0) < 500) break;
      }
      const values = new Map<string, Map<string, string[]>>();
      for (let i = 0; i < deals.length; i += 100) {
        const ids = deals.slice(i, i + 100).map(d => d.id);
        const fieldIds = (fields ?? []).map(f => f.id);
        if (!fieldIds.length) break;
        const { data, error } = await supabase.from('deal_field_values').select('deal_id,field_id,value_text,value_json').in('deal_id', ids).in('field_id', fieldIds);
        if (error) throw error;
        for (const value of data ?? []) {
          const field = fields?.find(f => f.id === value.field_id);
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