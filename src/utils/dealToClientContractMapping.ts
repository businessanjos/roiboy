import { supabase } from "@/integrations/supabase/client";

// Field IDs for deal custom fields
// Field IDs for deal custom fields - IDs corretos do banco de dados
export const DEAL_FIELD_IDS = {
  INSTAGRAM: '47df969b-735e-414f-a25e-2a56e589551d',
  CIDADE: '5accffbd-3d87-4735-b890-bc6c361694b7',
  BONUS: '82f58c54-d7e3-4d33-b73a-e214e1205b22',
  ITEM_VENDA: '033b91fb-3add-4c96-aec9-567fefbd0fb2',
  FORMA_PAGAMENTO: 'b2cd2366-b990-43d9-a0b7-1b567fbed729',
  DESCRICAO_NEGOCIACAO: 'ca39f0cf-d071-4271-a2a9-23d9d6993780',
};

// Mapping from "Item da Venda" select values to product names (fallback estático)
const ITEM_VENDA_TO_PRODUCT: Record<string, string> = {
  // Existentes
  'eternum_private': 'Eternum Private',
  'ren_eternum_private': 'Eternum Private',
  'eternum_club': 'Eternum Club',
  'ren_eternum_club': 'Eternum Club',
  'rykas_mentoring': 'Rykas Mentoring',
  'ren_rykas_mentoring': 'Rykas Mentoring',
  'conselho_anjo': 'Conselho de Anjo',
  'makers_club': 'Makers Club',
  'mentoria_makers': 'Mentoria Makers',
  
  // NOVOS - adicionando os faltantes
  'rykas_pass': 'Rykas Pass',
  'eternum_mvp': 'Eternum MVP',
  'anjoszap_basic': 'Anjoszap - Basic',
  'anjoszap_premium': 'Anjoszap - Premium',
  'liberty_ia_mensal': 'Liberty IA - Mensal',
  'liberty_ia_anual': 'Liberty IA - Anual',
};

// Cache for product IDs to avoid repeated DB calls
let productCache: Record<string, string> | null = null;
let productCacheTimestamp: number = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

// Busca o label da opção selecionada no campo "Item da Venda"
async function getItemVendaLabel(itemVendaValue: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('custom_fields')
      .select('options')
      .eq('id', DEAL_FIELD_IDS.ITEM_VENDA)
      .maybeSingle();
    
    if (error) {
      console.error('[DealMapping] Error fetching custom field options:', error);
      return null;
    }
    
    if (!data?.options) {
      console.warn('[DealMapping] No options found for Item da Venda field');
      return null;
    }
    
    const options = data.options as Array<{ value: string; label: string }>;
    const option = options.find(o => o.value === itemVendaValue);
    
    if (option) {
      console.log('[DealMapping] Found label for value:', itemVendaValue, '->', option.label);
    }
    
    return option?.label || null;
  } catch (error) {
    console.error('[DealMapping] Exception fetching item venda label:', error);
    return null;
  }
}

export async function getProductIdByName(productName: string): Promise<string | null> {
  const now = Date.now();
  
  // Invalidar cache se expirou
  if (!productCache || (now - productCacheTimestamp) > CACHE_TTL_MS) {
    const { data } = await supabase
      .from('products')
      .select('id, name')
      .eq('is_active', true);
    
    productCache = {};
    (data || []).forEach((p: { id: string; name: string }) => {
      productCache![p.name.toLowerCase().trim()] = p.id;
    });
    productCacheTimestamp = now;
    console.log('[DealMapping] Product cache refreshed with', Object.keys(productCache).length, 'products');
  }
  
  const normalizedSearch = productName.toLowerCase().trim();
  
  // Match exato primeiro
  if (productCache[normalizedSearch]) {
    return productCache[normalizedSearch];
  }
  
  // Match parcial (contém)
  const productNames = Object.keys(productCache);
  
  // Tenta encontrar um produto cujo nome contém o termo de busca
  const partialMatch = productNames.find(name => 
    name.includes(normalizedSearch) || normalizedSearch.includes(name)
  );
  
  if (partialMatch) {
    console.log('[DealMapping] Partial match found:', normalizedSearch, '->', partialMatch);
    return productCache[partialMatch];
  }
  
  return null;
}

export async function mapItemVendaToProductId(itemVendaValue: string): Promise<string | null> {
  console.log('[DealMapping] Mapping item da venda:', itemVendaValue);
  
  if (!itemVendaValue) {
    console.warn('[DealMapping] No item venda value provided');
    return null;
  }
  
  // 1. Primeiro, tentar pelo mapeamento estático (compatibilidade)
  const staticProductName = ITEM_VENDA_TO_PRODUCT[itemVendaValue];
  if (staticProductName) {
    console.log('[DealMapping] Found static mapping:', itemVendaValue, '->', staticProductName);
    const productId = await getProductIdByName(staticProductName);
    if (productId) {
      console.log('[DealMapping] Mapped to product via static:', productId);
      return productId;
    }
    console.warn('[DealMapping] Static mapping found but product not in DB:', staticProductName);
  }
  
  // 2. Fallback: buscar label da opção e fazer match com produto
  const label = await getItemVendaLabel(itemVendaValue);
  if (!label) {
    console.warn('[DealMapping] Could not find label for item venda:', itemVendaValue);
    return null;
  }
  
  // Limpar prefixo "Ren. " ou "Ren " se existir para match
  const cleanLabel = label.replace(/^Ren\.?\s*/i, '').trim();
  console.log('[DealMapping] Trying dynamic match with label:', label, '-> cleaned:', cleanLabel);
  
  // Tentar com label limpo
  let productId = await getProductIdByName(cleanLabel);
  
  // Se não encontrou, tentar com label original
  if (!productId && cleanLabel !== label) {
    productId = await getProductIdByName(label);
  }
  
  if (!productId) {
    console.warn('[DealMapping] Could not find product for:', itemVendaValue, '- label:', label, '- cleanLabel:', cleanLabel);
  } else {
    console.log('[DealMapping] Mapped to product via dynamic:', productId);
  }
  
  return productId;
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
  
  console.log('[DealMapping] Fetched deal field values for deal:', dealId, result);
  
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
    console.log('[DealMapping] Getting contract data - itemVenda:', dealFieldValues.itemVenda);
    result.product_id = await mapItemVendaToProductId(dealFieldValues.itemVenda);
    
    if (!result.product_id) {
      console.error('[DealMapping] CRITICAL: Failed to map itemVenda to product:', dealFieldValues.itemVenda);
    }
  } else {
    console.warn('[DealMapping] No itemVenda in deal field values');
  }
  
  // Map Forma de Pagamento
  if (dealFieldValues.formaPagamento) {
    result.payment_method = dealFieldValues.formaPagamento;
  }
  
  // Map Descrição da Negociação
  if (dealFieldValues.descricaoNegociacao) {
    result.negotiation_description = dealFieldValues.descricaoNegociacao;
  }
  
  console.log('[DealMapping] Contract data result:', result);
  
  return result;
}
