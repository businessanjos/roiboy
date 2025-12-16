import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OMIE_APP_KEY = Deno.env.get('OMIE_APP_KEY');
const OMIE_APP_SECRET = Deno.env.get('OMIE_APP_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface OmieCliente {
  codigo_cliente_omie: number;
  codigo_cliente_integracao?: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj_cpf: string;
  telefone1_ddd?: string;
  telefone1_numero?: string;
  telefone2_ddd?: string;
  telefone2_numero?: string;
  email?: string;
  endereco?: string;
  endereco_numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  observacao?: string;
  pessoa_fisica?: string; // "S" or "N"
  data_nascimento?: string;
}

interface OmieContaReceber {
  codigo_lancamento_omie: number;
  codigo_cliente_fornecedor: number;
  data_vencimento: string;
  data_emissao: string;
  valor_documento: number;
  valor_pago_soma?: number;
  status_titulo: string;
  descricao?: string;
  numero_documento?: string;
}

// Clean CPF/CNPJ for comparison (remove formatting)
const cleanDocument = (doc: string): string => {
  return doc?.replace(/\D/g, '') || '';
};

// Format phone to E.164
const formatPhoneE164 = (ddd?: string, numero?: string): string | null => {
  if (!numero) return null;
  const cleanDdd = (ddd || '').replace(/\D/g, '');
  const cleanNumero = numero.replace(/\D/g, '');
  if (!cleanNumero) return null;
  return `+55${cleanDdd}${cleanNumero}`;
};

// Map Omie status to our payment_status
const mapOmieStatus = (status: string, dataVencimento: string): string => {
  const hoje = new Date();
  const vencimento = new Date(dataVencimento);
  
  switch (status) {
    case 'LIQUIDADO':
      return 'active';
    case 'PARCIAL':
      return vencimento < hoje ? 'overdue' : 'pending';
    case 'ATRASADO':
      return 'overdue';
    case 'A_VENCER':
      return 'active';
    case 'CANCELADO':
      return 'cancelled';
    default:
      return vencimento < hoje ? 'overdue' : 'pending';
  }
};

// Call Omie API
async function callOmieApi(endpoint: string, call: string, param: any) {
  console.log(`Calling Omie API: ${endpoint}/${call}`, JSON.stringify(param));
  
  const response = await fetch(`https://app.omie.com.br/api/v1/${endpoint}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      call,
      app_key: OMIE_APP_KEY,
      app_secret: OMIE_APP_SECRET,
      param: [param],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Omie API error:', errorText);
    throw new Error(`Omie API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  
  // Check for Omie error in response
  if (result.faultstring) {
    console.error('Omie fault:', result.faultstring);
    throw new Error(`Omie: ${result.faultstring}`);
  }

  return result;
}

// Find client in Omie by CPF/CNPJ
async function findOmieClientByCpfCnpj(cpfCnpj: string): Promise<OmieCliente | null> {
  try {
    const cleanDoc = cleanDocument(cpfCnpj);
    if (!cleanDoc) return null;
    
    console.log(`Searching Omie client by CPF/CNPJ: ${cleanDoc}`);

    const result = await callOmieApi('geral/clientes', 'ListarClientes', {
      pagina: 1,
      registros_por_pagina: 10,
      clientesFiltro: { cnpj_cpf: cleanDoc },
    });

    if (result.clientes_cadastro && result.clientes_cadastro.length > 0) {
      console.log(`Found ${result.clientes_cadastro.length} client(s) by CPF/CNPJ`);
      return result.clientes_cadastro[0];
    }

    console.log('No client found by CPF/CNPJ');
    return null;
  } catch (error) {
    console.error('Error finding Omie client by CPF/CNPJ:', error);
    return null;
  }
}

// Find client in Omie by phone or name
async function findOmieClient(phone: string, name: string): Promise<OmieCliente | null> {
  try {
    // Clean phone for search
    const cleanPhone = phone.replace(/\D/g, '').slice(-9);
    
    console.log(`Searching Omie client by phone: ${cleanPhone}`);

    const result = await callOmieApi('geral/clientes', 'ListarClientes', {
      pagina: 1,
      registros_por_pagina: 50,
      clientesFiltro: { telefone1_numero: cleanPhone },
    });

    if (result.clientes_cadastro && result.clientes_cadastro.length > 0) {
      console.log(`Found ${result.clientes_cadastro.length} client(s) by phone`);
      return result.clientes_cadastro[0];
    }

    // If not found by phone, search by name
    console.log(`Searching Omie client by name: ${name}`);
    const resultByName = await callOmieApi('geral/clientes', 'ListarClientes', {
      pagina: 1,
      registros_por_pagina: 50,
      clientesFiltro: { razao_social: name },
    });

    if (resultByName.clientes_cadastro && resultByName.clientes_cadastro.length > 0) {
      const exactMatch = resultByName.clientes_cadastro.find(
        (c: OmieCliente) => c.razao_social.toLowerCase().includes(name.toLowerCase())
      );
      return exactMatch || resultByName.clientes_cadastro[0];
    }

    return null;
  } catch (error) {
    console.error('Error finding Omie client:', error);
    return null;
  }
}

// Get receivables for a client
async function getClientReceivables(codigoClienteOmie: number): Promise<OmieContaReceber[]> {
  try {
    const result = await callOmieApi('financas/contareceber', 'ListarContasReceber', {
      pagina: 1,
      registros_por_pagina: 100,
      filtrar_por_cliente: codigoClienteOmie,
      ordenar_por: 'DATA_VENCIMENTO',
    });

    return result.conta_receber_cadastro || [];
  } catch (error) {
    console.error('Error getting receivables:', error);
    return [];
  }
}

// Enrich client data from Omie
function buildClientUpdateFromOmie(omieClient: OmieCliente, existingEmails: string[] = [], existingPhones: string[] = []) {
  const updates: Record<string, any> = {};

  // CPF/CNPJ
  if (omieClient.cnpj_cpf) {
    const cleanDoc = cleanDocument(omieClient.cnpj_cpf);
    if (cleanDoc.length === 11) {
      updates.cpf = cleanDoc;
    } else if (cleanDoc.length === 14) {
      updates.cnpj = cleanDoc;
    }
  }

  // Company name
  if (omieClient.nome_fantasia || omieClient.razao_social) {
    updates.company_name = omieClient.nome_fantasia || omieClient.razao_social;
  }

  // Birth date (for pessoa física)
  if (omieClient.data_nascimento && omieClient.pessoa_fisica === 'S') {
    // Omie returns dates in DD/MM/YYYY format
    const [day, month, year] = omieClient.data_nascimento.split('/');
    if (day && month && year) {
      updates.birth_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  // Emails
  const emails = new Set(existingEmails);
  if (omieClient.email) {
    omieClient.email.split(/[;,]/).forEach(e => {
      const cleaned = e.trim().toLowerCase();
      if (cleaned && cleaned.includes('@')) emails.add(cleaned);
    });
  }
  if (emails.size > 0) {
    updates.emails = Array.from(emails);
  }

  // Additional phones
  const phones = new Set(existingPhones);
  const phone2 = formatPhoneE164(omieClient.telefone2_ddd, omieClient.telefone2_numero);
  if (phone2) phones.add(phone2);
  if (phones.size > 0) {
    updates.additional_phones = Array.from(phones);
  }

  // Address
  if (omieClient.endereco) updates.street = omieClient.endereco;
  if (omieClient.endereco_numero) updates.street_number = omieClient.endereco_numero;
  if (omieClient.complemento) updates.complement = omieClient.complemento;
  if (omieClient.bairro) updates.neighborhood = omieClient.bairro;
  if (omieClient.cidade) updates.city = omieClient.cidade;
  if (omieClient.estado) updates.state = omieClient.estado;
  if (omieClient.cep) updates.zip_code = cleanDocument(omieClient.cep);

  // Notes - append Omie observation if exists
  if (omieClient.observacao) {
    updates.notes = omieClient.observacao;
  }

  return updates;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!OMIE_APP_KEY || !OMIE_APP_SECRET) {
      throw new Error('Credenciais Omie não configuradas. Configure OMIE_APP_KEY e OMIE_APP_SECRET.');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const body = await req.json();
    const { client_id, account_id, sync_all, enrich_data = true, use_cpf_cnpj = true } = body;
    
    console.log('Starting Omie sync...', { client_id, account_id, sync_all, enrich_data, use_cpf_cnpj });

    let clientsToSync: any[] = [];

    if (sync_all && account_id) {
      // Sync all clients from account
      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, full_name, phone_e164, cpf, cnpj, emails, additional_phones, account_id')
        .eq('account_id', account_id);

      if (error) throw error;
      clientsToSync = clients || [];
    } else if (client_id) {
      // Sync single client
      const { data: client, error } = await supabase
        .from('clients')
        .select('id, full_name, phone_e164, cpf, cnpj, emails, additional_phones, account_id')
        .eq('id', client_id)
        .single();

      if (error) throw error;
      if (client) clientsToSync = [client];
    }

    const results = {
      synced: 0,
      enriched: 0,
      errors: 0,
      not_found: 0,
      details: [] as any[],
    };

    for (const client of clientsToSync) {
      try {
        console.log(`Syncing client: ${client.full_name} (${client.phone_e164})`);

        let omieClient: OmieCliente | null = null;

        // First, try to find by CPF/CNPJ if available and option is enabled
        if (use_cpf_cnpj && (client.cpf || client.cnpj)) {
          const docToSearch = client.cnpj || client.cpf;
          console.log(`Searching by CPF/CNPJ: ${docToSearch}`);
          omieClient = await findOmieClientByCpfCnpj(docToSearch);
        }

        // If not found by document, try phone/name
        if (!omieClient) {
          console.log('Document not found, trying phone/name...');
          omieClient = await findOmieClient(client.phone_e164, client.full_name);
        }

        if (!omieClient) {
          console.log(`Client not found in Omie: ${client.full_name}`);
          results.not_found++;
          results.details.push({
            client_id: client.id,
            name: client.full_name,
            status: 'not_found',
            message: 'Cliente não encontrado na Omie',
          });
          continue;
        }

        console.log(`Found Omie client: ${omieClient.razao_social} (${omieClient.codigo_cliente_omie})`);

        const accountId = client.account_id || account_id;

        // Enrich client data if option is enabled
        if (enrich_data) {
          const clientUpdates = buildClientUpdateFromOmie(
            omieClient, 
            client.emails || [], 
            client.additional_phones || []
          );

          if (Object.keys(clientUpdates).length > 0) {
            console.log('Enriching client data:', clientUpdates);
            const { error: updateError } = await supabase
              .from('clients')
              .update(clientUpdates)
              .eq('id', client.id);

            if (updateError) {
              console.error('Error enriching client:', updateError);
            } else {
              results.enriched++;
            }
          }
        }

        // Get receivables
        const receivables = await getClientReceivables(omieClient.codigo_cliente_omie);
        console.log(`Found ${receivables.length} receivables`);

        if (receivables.length === 0) {
          results.details.push({
            client_id: client.id,
            name: client.full_name,
            status: 'no_receivables',
            message: 'Nenhuma conta a receber encontrada',
            enriched: enrich_data,
            omie_client: omieClient.razao_social,
          });
          continue;
        }

        // Group by status and get latest data
        const openReceivables = receivables.filter(r => r.status_titulo !== 'LIQUIDADO' && r.status_titulo !== 'CANCELADO');
        const hasOverdue = receivables.some(r => r.status_titulo === 'ATRASADO');
        const totalOpen = openReceivables.reduce((sum, r) => sum + (r.valor_documento - (r.valor_pago_soma || 0)), 0);

        // Determine overall payment status
        let overallStatus: string;
        if (hasOverdue) {
          overallStatus = 'overdue';
        } else if (openReceivables.length > 0) {
          overallStatus = 'active';
        } else {
          overallStatus = 'active';
        }

        // Get next billing date
        const nextReceivable = openReceivables
          .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime())[0];

        // Check if subscription exists for this client
        const { data: existingSubscription } = await supabase
          .from('client_subscriptions')
          .select('id')
          .eq('client_id', client.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const subscriptionData = {
          payment_status: overallStatus,
          next_billing_date: nextReceivable?.data_vencimento || null,
          amount: totalOpen > 0 ? totalOpen : (receivables[0]?.valor_documento || 0),
          notes: `Sincronizado via Omie em ${new Date().toLocaleString('pt-BR')}. ${hasOverdue ? '⚠️ Possui títulos em atraso!' : ''}`,
        };

        if (existingSubscription) {
          const { error: updateError } = await supabase
            .from('client_subscriptions')
            .update(subscriptionData)
            .eq('id', existingSubscription.id);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('client_subscriptions')
            .insert({
              ...subscriptionData,
              account_id: accountId,
              client_id: client.id,
              product_name: 'Importado da Omie',
              billing_period: 'monthly',
              start_date: receivables[0]?.data_emissao || new Date().toISOString().split('T')[0],
            });

          if (insertError) throw insertError;
        }

        results.synced++;
        results.details.push({
          client_id: client.id,
          name: client.full_name,
          status: 'synced',
          payment_status: overallStatus,
          has_overdue: hasOverdue,
          open_amount: totalOpen,
          enriched: enrich_data,
          omie_client: omieClient.razao_social,
        });

      } catch (clientError: any) {
        console.error(`Error syncing client ${client.id}:`, clientError);
        results.errors++;
        results.details.push({
          client_id: client.id,
          name: client.full_name,
          status: 'error',
          message: clientError.message,
        });
      }
    }

    console.log('Omie sync completed:', results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in sync-omie function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
