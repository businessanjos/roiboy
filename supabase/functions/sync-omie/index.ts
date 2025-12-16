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
  cnpj_cpf: string;
  telefone1_numero?: string;
  email?: string;
}

interface OmieContaReceber {
  codigo_lancamento_omie: number;
  codigo_cliente_fornecedor: number;
  data_vencimento: string;
  data_emissao: string;
  valor_documento: number;
  valor_pago_soma?: number;
  status_titulo: string; // LIQUIDADO, ATRASADO, A_VENCER, PARCIAL
  descricao?: string;
  numero_documento?: string;
}

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
    throw new Error(`Omie API error: ${response.status}`);
  }

  return response.json();
}

// Find client in Omie by phone or name
async function findOmieClient(phone: string, name: string): Promise<OmieCliente | null> {
  try {
    // Clean phone for search
    const cleanPhone = phone.replace(/\D/g, '').slice(-9); // Last 9 digits
    
    // Search by phone
    const result = await callOmieApi('geral/clientes', 'ListarClientes', {
      pagina: 1,
      registros_por_pagina: 50,
      clientesFiltro: { telefone1_numero: cleanPhone },
    });

    if (result.clientes_cadastro && result.clientes_cadastro.length > 0) {
      return result.clientes_cadastro[0];
    }

    // If not found by phone, search by name
    const resultByName = await callOmieApi('geral/clientes', 'ListarClientes', {
      pagina: 1,
      registros_por_pagina: 50,
      clientesFiltro: { razao_social: name },
    });

    if (resultByName.clientes_cadastro && resultByName.clientes_cadastro.length > 0) {
      // Try to find exact match
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!OMIE_APP_KEY || !OMIE_APP_SECRET) {
      throw new Error('Omie credentials not configured');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const { client_id, account_id, sync_all } = await req.json();
    
    console.log('Starting Omie sync...', { client_id, account_id, sync_all });

    let clientsToSync: any[] = [];

    if (sync_all && account_id) {
      // Sync all clients from account
      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, full_name, phone_e164')
        .eq('account_id', account_id);

      if (error) throw error;
      clientsToSync = clients || [];
    } else if (client_id) {
      // Sync single client
      const { data: client, error } = await supabase
        .from('clients')
        .select('id, full_name, phone_e164, account_id')
        .eq('id', client_id)
        .single();

      if (error) throw error;
      if (client) clientsToSync = [client];
    }

    const results = {
      synced: 0,
      errors: 0,
      details: [] as any[],
    };

    for (const client of clientsToSync) {
      try {
        console.log(`Syncing client: ${client.full_name} (${client.phone_e164})`);

        // Find client in Omie
        const omieClient = await findOmieClient(client.phone_e164, client.full_name);

        if (!omieClient) {
          console.log(`Client not found in Omie: ${client.full_name}`);
          results.details.push({
            client_id: client.id,
            name: client.full_name,
            status: 'not_found',
            message: 'Cliente não encontrado na Omie',
          });
          continue;
        }

        console.log(`Found Omie client: ${omieClient.razao_social} (${omieClient.codigo_cliente_omie})`);

        // Get receivables
        const receivables = await getClientReceivables(omieClient.codigo_cliente_omie);
        console.log(`Found ${receivables.length} receivables`);

        if (receivables.length === 0) {
          results.details.push({
            client_id: client.id,
            name: client.full_name,
            status: 'no_receivables',
            message: 'Nenhuma conta a receber encontrada',
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
          overallStatus = 'active'; // All paid
        }

        // Get next billing date
        const nextReceivable = openReceivables
          .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime())[0];

        const accountId = client.account_id || account_id;

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
          // Update existing subscription
          const { error: updateError } = await supabase
            .from('client_subscriptions')
            .update(subscriptionData)
            .eq('id', existingSubscription.id);

          if (updateError) throw updateError;
        } else {
          // Create new subscription
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