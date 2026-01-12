import { supabase } from "@/integrations/supabase/client";

// Field IDs for deal custom fields
export const DEAL_FIELD_IDS = {
  INSTAGRAM: '47df969b-735e-414f-a25e-2a56e589551d',
  CIDADE: '5accffbd-3d87-4735-b890-bc6c361694b7',
  BONUS: '82f58c54-d7e3-4d33-b73a-e214e1205b22',
  ITEM_VENDA: '033b91fb-0bdf-4ac6-ac45-6ebbb4f61f72',
  FORMA_PAGAMENTO: 'b2cd2366-67f8-4cd1-99a9-d19e68c05fed',
  DESCRICAO_NEGOCIACAO: 'ca39f0cf-a88b-4ee0-80a9-6ecc8df7bf29',
};

// Mapping from "Item da Venda" select values to product names
const ITEM_VENDA_TO_PRODUCT: Record<string, string> = {
  'eternum_private': 'Eternum Private',
  'ren_eternum_private': 'Eternum Private',
  'eternum_club': 'Eternum Club',
  'ren_eternum_club': 'Eternum Club',
  'rykas_mentoring': 'Rykas Mentoring',
  'ren_rykas_mentoring': 'Rykas Mentoring',
  'conselho_anjo': 'Conselho de Anjo',
  'makers_club': 'Makers Club',
  'mentoria_makers': 'Mentoria Makers',
};

// Cache for product IDs to avoid repeated DB calls
let productCache: Record<string, string> | null = null;

export async function getProductIdByName(productName: string): Promise<string | null> {
  if (!productCache) {
    const { data } = await supabase
      .from('products')
      .select('id, name')
      .eq('is_active', true);
    
    productCache = {};
    (data || []).forEach((p: { id: string; name: string }) => {
      productCache![p.name.toLowerCase()] = p.id;
    });
  }
  
  return productCache[productName.toLowerCase()] || null;
}

export async function mapItemVendaToProductId(itemVendaValue: string): Promise<string | null> {
  const productName = ITEM_VENDA_TO_PRODUCT[itemVendaValue];
  if (!productName) return null;
  
  return getProductIdByName(productName);
}

export interface DealFieldValues {
  instagram?: string;
  cidade?: { city?: string; state?: string; formatted_address?: string };
  bonus?: string[];
  itemVenda?: string;
  formaPagamento?: string;
  descricaoNegociacao?: string;
}

export async function fetchDealCustomFieldValues(dealId: string): Promise<DealFieldValues> {
  const { data } = await supabase
    .from('deal_field_values')
    .select('field_id, value_text, value_json')
    .eq('deal_id', dealId);
  
  const result: DealFieldValues = {};
  
  (data || []).forEach((row: { field_id: string; value_text: string | null; value_json: any }) => {
    switch (row.field_id) {
      case DEAL_FIELD_IDS.INSTAGRAM:
        result.instagram = row.value_text || undefined;
        break;
      case DEAL_FIELD_IDS.CIDADE:
        result.cidade = row.value_json as DealFieldValues['cidade'];
        break;
      case DEAL_FIELD_IDS.BONUS:
        result.bonus = row.value_json as string[];
        break;
      case DEAL_FIELD_IDS.ITEM_VENDA:
        result.itemVenda = row.value_text || undefined;
        break;
      case DEAL_FIELD_IDS.FORMA_PAGAMENTO:
        result.formaPagamento = row.value_text || undefined;
        break;
      case DEAL_FIELD_IDS.DESCRICAO_NEGOCIACAO:
        result.descricaoNegociacao = row.value_text || undefined;
        break;
    }
  });
  
  return result;
}

export async function updateClientWithDealData(
  clientId: string,
  accountId: string,
  dealFieldValues: DealFieldValues
): Promise<void> {
  const updates: Record<string, any> = {};
  
  // Update Instagram if present
  if (dealFieldValues.instagram) {
    updates.instagram = dealFieldValues.instagram;
  }
  
  // Update City/State if present
  if (dealFieldValues.cidade) {
    if (dealFieldValues.cidade.city) {
      updates.city = dealFieldValues.cidade.city;
    }
    if (dealFieldValues.cidade.state) {
      updates.state = dealFieldValues.cidade.state;
    }
  }
  
  // Only update if there are changes
  if (Object.keys(updates).length > 0) {
    await supabase
      .from('clients')
      .update(updates)
      .eq('id', clientId);
  }
  
  // Copy "Ganhou Bônus?" to client_field_values if present
  if (dealFieldValues.bonus && dealFieldValues.bonus.length > 0) {
    await supabase
      .from('client_field_values')
      .upsert({
        client_id: clientId,
        field_id: DEAL_FIELD_IDS.BONUS,
        account_id: accountId,
        value_json: dealFieldValues.bonus,
      }, {
        onConflict: 'client_id,field_id'
      });
  }
}

export interface ContractDataFromDeal {
  product_id?: string | null;
  payment_method?: string | null;
  negotiation_description?: string | null;
}

export async function getContractDataFromDealFields(
  dealFieldValues: DealFieldValues
): Promise<ContractDataFromDeal> {
  const result: ContractDataFromDeal = {};
  
  // Map Item da Venda to product_id
  if (dealFieldValues.itemVenda) {
    result.product_id = await mapItemVendaToProductId(dealFieldValues.itemVenda);
  }
  
  // Map Forma de Pagamento
  if (dealFieldValues.formaPagamento) {
    result.payment_method = dealFieldValues.formaPagamento;
  }
  
  // Map Descrição da Negociação
  if (dealFieldValues.descricaoNegociacao) {
    result.negotiation_description = dealFieldValues.descricaoNegociacao;
  }
  
  return result;
}
