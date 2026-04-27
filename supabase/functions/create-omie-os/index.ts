import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function callOmieApi(appKey: string, appSecret: string, endpoint: string, call: string, param: any) {
  const response = await fetch(`https://app.omie.com.br/api/v1/${endpoint}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      call,
      app_key: appKey,
      app_secret: appSecret,
      param: [param],
    }),
  });

  const result = await response.json();
  if (result.faultstring) {
    throw new Error(`Omie: ${result.faultstring}`);
  }
  return result;
}

const STATE_MAP: Record<string, string> = {
  'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM',
  'Bahia': 'BA', 'Ceará': 'CE', 'Distrito Federal': 'DF', 'Espírito Santo': 'ES',
  'Goiás': 'GO', 'Maranhão': 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS',
  'Minas Gerais': 'MG', 'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR',
  'Pernambuco': 'PE', 'Piauí': 'PI', 'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN',
  'Rio Grande do Sul': 'RS', 'Rondônia': 'RO', 'Roraima': 'RR', 'Santa Catarina': 'SC',
  'São Paulo': 'SP', 'Sergipe': 'SE', 'Tocantins': 'TO',
};


async function findOmieClientByCpfCnpj(appKey: string, appSecret: string, cpfCnpj: string, expectedName?: string) {
  try {
    const cleanDoc = cpfCnpj.replace(/\D/g, '');
    if (!cleanDoc) return null;
    const result = await callOmieApi(appKey, appSecret, 'geral/clientes', 'ListarClientes', {
      pagina: 1,
      registros_por_pagina: 10,
      clientesFiltro: { cnpj_cpf: cleanDoc },
    });
    const found = result.clientes_cadastro?.[0] || null;
    
    // Validate: if we have an expected name, check the found client matches
    if (found && expectedName) {
      const foundName = (found.razao_social || found.nome_fantasia || '').toLowerCase().trim();
      const expected = expectedName.toLowerCase().trim();
      // Check if any word (3+ chars) from expected name appears in found name
      const expectedWords = expected.split(/\s+/).filter((w: string) => w.length >= 3);
      const hasAnyMatch = expectedWords.some((word: string) => foundName.includes(word));
      if (!hasAnyMatch) {
        console.log(`CPF/CNPJ ${cleanDoc} found client "${found.razao_social}" but expected "${expectedName}" - names don't match, skipping`);
        return null;
      }
    }
    
    return found;
  } catch {
    return null;
  }
}

async function findOmieClientByName(appKey: string, appSecret: string, name: string) {
  try {
    const result = await callOmieApi(appKey, appSecret, 'geral/clientes', 'ListarClientes', {
      pagina: 1,
      registros_por_pagina: 10,
      clientesFiltro: { razao_social: name },
    });
    return result.clientes_cadastro?.[0] || null;
  } catch {
    return null;
  }
}

async function findOmieVendedorByName(appKey: string, appSecret: string, name: string): Promise<number | null> {
  try {
    if (!name) return null;
    const result = await callOmieApi(appKey, appSecret, 'geral/vendedores', 'ListarVendedores', {
      pagina: 1,
      registros_por_pagina: 50,
    });
    const vendedores = result.cadastro || [];
    // Busca case-insensitive pelo nome
    const nameLower = name.toLowerCase().trim();
    const found = vendedores.find((v: any) => {
      const vName = (v.nome || '').toLowerCase().trim();
      return vName === nameLower || vName.includes(nameLower) || nameLower.includes(vName);
    });
    return found?.codigo || null;
  } catch {
    return null;
  }
}

async function createOmieClient(
  appKey: string,
  appSecret: string,
  clientData: {
    cpfCnpj: string;
    name: string;
    email?: string;
    phone?: string;
    street?: string;
    streetNumber?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    clientId?: string;
    dealId?: string;
  }
): Promise<any> {
  const cleanDoc = clientData.cpfCnpj.replace(/\D/g, '');
  const isPF = cleanDoc.length <= 11;

  const payload: any = {
    codigo_cliente_integracao: clientData.clientId || clientData.dealId || `ROY-${Date.now()}`,
    cnpj_cpf: cleanDoc,
    razao_social: clientData.name,
    nome_fantasia: clientData.name,
    contribuinte: 'N',
    endereco: clientData.street || 'A definir',
    endereco_numero: clientData.streetNumber || 'S/N',
    bairro: clientData.neighborhood || 'A definir',
    cidade: clientData.city || 'A definir',
    estado: clientData.state || 'SP',
    cep: clientData.zipCode?.replace(/\D/g, '') || '00000000',
    pessoa_fisica: isPF ? 'S' : 'N',
  };

  if (clientData.email) payload.email = clientData.email;
  if (clientData.phone) {
    const cleanPhone = clientData.phone.replace(/\D/g, '');
    if (cleanPhone.length >= 10) {
      payload.telefone1_ddd = cleanPhone.substring(0, 2);
      payload.telefone1_numero = cleanPhone.substring(2);
    }
  }

  console.log('Creating Omie client:', JSON.stringify(payload));
  const result = await callOmieApi(appKey, appSecret, 'geral/clientes', 'IncluirCliente', payload);
  console.log('Omie client created:', JSON.stringify(result));

  return {
    codigo_cliente_omie: result.codigo_cliente_omie,
    codigo_cliente_integracao: result.codigo_cliente_integracao,
    razao_social: clientData.name,
  };
}

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function resolveFieldValue(
  fieldMapping: { source: string; customFieldId?: string },
  deal: any,
  client: any,
  dealFieldValues: any[],
  responsibleUserName: string
): string {
  const { source, customFieldId } = fieldMapping;
  
  switch (source) {
    case 'deal.title': return deal.title || '';
    case 'deal.value': return String(deal.value || 0);
    case 'deal.description': return deal.description || '';
    case 'deal.responsible': return responsibleUserName || '';
    case 'client.name': return client?.full_name || '';
    case 'client.cpf_cnpj': return client?.cnpj || client?.cpf || '';
    case 'client.phone': return client?.phone_e164 || '';
    case 'client.email': {
      const emails = client?.emails;
      if (Array.isArray(emails) && emails.length > 0) return emails[0];
      return '';
    }
    case 'custom_field': {
      if (!customFieldId) return '';
      const fv = dealFieldValues.find((v: any) => v.field_id === customFieldId);
      return fv?.value_text || fv?.value_number?.toString() || '';
    }
    default: return '';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Parse body early so we have deal_id/account_id available in catch block
  const body = await req.json();
  const { deal_id, account_id } = body;

  try {
    if (!deal_id || !account_id) throw new Error('deal_id and account_id are required');

    // 1. Get Omie settings
    const { data: settings, error: settingsErr } = await supabase
      .from('omie_settings')
      .select('*')
      .eq('account_id', account_id)
      .single();
    
    if (settingsErr || !settings) throw new Error('Configurações Omie não encontradas');
    if (!settings.app_key || !settings.app_secret) throw new Error('APP_KEY ou APP_SECRET não configurados');

    const appKey = settings.app_key;
    const appSecret = settings.app_secret;
    const fieldMappings = (settings.field_mappings || {}) as Record<string, any>;

    // 2. Get deal data
    const { data: deal, error: dealErr } = await supabase
      .from('deals')
      .select('*, client:clients(id, full_name, phone_e164, cpf, cnpj, emails)')
      .eq('id', deal_id)
      .single();
    
    if (dealErr || !deal) throw new Error('Negócio não encontrado');

    // 3. Get deal custom field values
    const { data: dealFieldValues } = await supabase
      .from('deal_field_values')
      .select('field_id, value_text, value_number, value_boolean, value_date, value_json')
      .eq('deal_id', deal_id);

    // 4. Get responsible user name
    let responsibleUserName = '';
    if (deal.responsible_user_id) {
      const { data: user } = await supabase
        .from('users')
        .select('name')
        .eq('id', deal.responsible_user_id)
        .single();
      responsibleUserName = user?.name || '';
    }

    const client = deal.client;

    // 5. Find client in Omie
    let omieClient: any = null;
    
    // Try CPF/CNPJ from deal custom field first (field "CPF ou CNPJ")
    const CPF_CNPJ_FIELD_ID = 'de5d8543-287e-4ad9-917a-813d48d0d3eb';
    const cpfCnpjFromDeal = (dealFieldValues || []).find(
      (v: any) => v.field_id === CPF_CNPJ_FIELD_ID
    )?.value_text || '';

    // Fallback to client record fields
    const clientCpfCnpj = cpfCnpjFromDeal || client?.cnpj || client?.cpf || '';
    
    const expectedClientName = client?.full_name || deal.contact_name || deal.title;
    
    if (clientCpfCnpj) {
      omieClient = await findOmieClientByCpfCnpj(appKey, appSecret, clientCpfCnpj, expectedClientName);
    }
    
    // Fallback to name
    if (!omieClient) {
      omieClient = await findOmieClientByName(appKey, appSecret, expectedClientName);
    }

    if (!omieClient) {
      if (clientCpfCnpj) {
        // Auto-create client in Omie
        const clientName = expectedClientName;
        const clientEmail = Array.isArray(client?.emails) && client.emails.length > 0 ? client.emails[0] : '';
        const clientPhone = client?.phone_e164 || '';

        console.log(`Cliente não encontrado no Omie. Criando automaticamente: ${clientName} (${clientCpfCnpj})`);

        // Extract city/state from deal's "Cidade" custom field
        const CIDADE_FIELD_ID = '5accffbd-3d87-4735-b890-bc6c361694b7';
        const cidadeFieldValue = (dealFieldValues || []).find((v: any) => v.field_id === CIDADE_FIELD_ID);
        const cidadeJson = cidadeFieldValue?.value_json as any;
        const addressParts = cidadeJson?.formatted_address?.split(',').map((s: string) => s.trim()) || [];
        const cityFromDeal = addressParts[0] || '';
        const stateFullName = addressParts[1] || '';
        const stateUF = STATE_MAP[stateFullName] || (stateFullName.length === 2 ? stateFullName.toUpperCase() : '');

        console.log(`Endereço extraído do campo Cidade: city=${cityFromDeal}, state=${stateUF} (${stateFullName})`);

        omieClient = await createOmieClient(appKey, appSecret, {
          cpfCnpj: clientCpfCnpj,
          name: clientName,
          email: clientEmail,
          phone: clientPhone,
          city: cityFromDeal,
          state: stateUF,
          clientId: client?.id,
          dealId: deal_id,
        });

        // Log auto-creation
        await supabase.from('omie_integration_logs').insert({
          account_id,
          deal_id,
          action: 'auto_create_client',
          status: 'success',
          omie_os_id: String(omieClient.codigo_cliente_omie || ''),
          request_payload: { cpfCnpj: clientCpfCnpj, name: clientName },
          response_payload: omieClient,
        });

        console.log(`Cliente criado no Omie com código: ${omieClient.codigo_cliente_omie}`);
      } else {
        throw new Error(`Cliente não encontrado no Omie e sem CPF/CNPJ para auto-cadastro. Busca por: ${client?.full_name || 'N/A'}`);
      }
    }

    // 6. Validate required fields
    if (!settings.default_category_code) {
      throw new Error('Código da Categoria não configurado nas configurações do Omie.');
    }
    if (!settings.default_bank_account_code) {
      throw new Error('Conta Corrente (nCodCC) não configurada nas configurações do Omie.');
    }
    if (!settings.default_service_code) {
      throw new Error('Código do Serviço Municipal não configurado nas configurações do Omie.');
    }
    if (!settings.default_service_lc116_code) {
      throw new Error('Código do Serviço LC116 não configurado nas configurações do Omie.');
    }

    // 7. Build OS payload
    const vendedor = resolveFieldValue(
      fieldMappings.vendedor || { source: 'deal.responsible' },
      deal, client, dealFieldValues || [], responsibleUserName
    );
    
    let descricao = resolveFieldValue(
      fieldMappings.descricao || { source: 'deal.description' },
      deal, client, dealFieldValues || [], responsibleUserName
    );

    // Se descricao é um UUID, resolver o nome do produto
    if (descricao && isUUID(descricao)) {
      const { data: product } = await supabase
        .from('products')
        .select('name')
        .eq('id', descricao)
        .single();
      if (product?.name) {
        descricao = product.name;
      }
    }

    const valorStr = resolveFieldValue(
      fieldMappings.valor || { source: 'deal.value' },
      deal, client, dealFieldValues || [], responsibleUserName
    );
    const valor = parseFloat(valorStr) || 0;

    // Buscar código do vendedor no Omie pelo nome do responsável
    let nCodVend: number | null = null;
    if (vendedor) {
      nCodVend = await findOmieVendedorByName(appKey, appSecret, vendedor);
      console.log(`Vendedor "${vendedor}" -> nCodVend: ${nCodVend}`);
    }

    const osPayload = {
      Cabecalho: {
        cCodIntOS: `ROY-${deal_id.substring(0, 8)}`,
        cEtapa: '10', // OS aberta
        dDtPrevisao: new Date().toISOString().split('T')[0].split('-').reverse().join('/'),
        nCodCli: omieClient.codigo_cliente_omie,
        nQtdeParc: 1,
        ...(nCodVend ? { nCodVend } : {}),
      },
      InformacoesAdicionais: {
        cDadosAdicNF: descricao || `Negócio: ${deal.title}`,
        cCodCateg: settings.default_category_code,
        nCodCC: Number(settings.default_bank_account_code),
        ...(settings.default_city ? { cCidPrestServ: settings.default_city } : {}),
      },
      ServicosPrestados: [
        {
          cCodServLC116: settings.default_service_lc116_code || '',
          cCodServMun: settings.default_service_code || '',
          cDescServ: descricao || deal.title,
          cTribServ: settings.default_tax_type || '01',
          cRetemISS: settings.default_retem_iss || 'N',
          nQtde: 1,
          nValUnit: valor,
        },
      ],
      Observacoes: {
        cObsOS: `Gerado automaticamente pelo ROY APP. Vendedor: ${vendedor}. Negócio: ${deal.title}`,
      },
    };

    // 7. Call Omie API to create OS
    console.log('OS Payload:', JSON.stringify(osPayload));
    const result = await callOmieApi(appKey, appSecret, 'servicos/os', 'IncluirOS', osPayload);

    const omieOsId = result.nCodOS || result.cCodIntOS || result.cNumOS || '';

    // 8. Log success
    await supabase.from('omie_integration_logs').insert({
      account_id,
      deal_id,
      action: 'create_os',
      status: 'success',
      omie_os_id: String(omieOsId),
      request_payload: osPayload,
      response_payload: result,
    });

    return new Response(JSON.stringify({ success: true, omie_os_id: omieOsId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in create-omie-os:', error);

    // Log error
    try {
      await supabase.from('omie_integration_logs').insert({
        account_id,
        deal_id,
        action: 'create_os',
        status: 'error',
        error_message: error.message,
      });
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
