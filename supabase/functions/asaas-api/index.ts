import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
const ASAAS_BASE_URL = 'https://api.asaas.com/v3'; // Use 'https://sandbox.asaas.com/api/v3' for sandbox

interface AsaasCustomer {
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  externalReference?: string;
}

interface AsaasSubscription {
  customer: string;
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
  value: number;
  nextDueDate: string;
  cycle: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  description?: string;
  externalReference?: string;
}

interface AsaasPayment {
  customer: string;
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
}

async function asaasRequest(endpoint: string, method: string, body?: object) {
  console.log(`[Asaas API] ${method} ${endpoint}`);
  
  const response = await fetch(`${ASAAS_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY!,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('[Asaas API] Error:', data);
    throw new Error(data.errors?.[0]?.description || 'Erro na API do Asaas');
  }

  console.log('[Asaas API] Success:', JSON.stringify(data).substring(0, 200));
  return data;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Não autorizado');
    }

    const { action, ...params } = await req.json();
    console.log(`[Asaas API] Action: ${action}, Params:`, JSON.stringify(params).substring(0, 200));

    let result;

    switch (action) {
      // ================== CUSTOMERS ==================
      case 'createCustomer': {
        const { name, cpfCnpj, email, phone, externalReference } = params;
        result = await asaasRequest('/customers', 'POST', {
          name,
          cpfCnpj: cpfCnpj?.replace(/\D/g, ''),
          email,
          phone: phone?.replace(/\D/g, ''),
          mobilePhone: phone?.replace(/\D/g, ''),
          externalReference,
        });
        break;
      }

      case 'getCustomer': {
        const { customerId } = params;
        result = await asaasRequest(`/customers/${customerId}`, 'GET');
        break;
      }

      case 'findCustomerByCpfCnpj': {
        const { cpfCnpj } = params;
        result = await asaasRequest(`/customers?cpfCnpj=${cpfCnpj?.replace(/\D/g, '')}`, 'GET');
        break;
      }

      case 'listCustomers': {
        const { offset = 0, limit = 10 } = params;
        result = await asaasRequest(`/customers?offset=${offset}&limit=${limit}`, 'GET');
        break;
      }

      case 'updateCustomer': {
        const { customerId, ...updateData } = params;
        result = await asaasRequest(`/customers/${customerId}`, 'PUT', updateData);
        break;
      }

      // ================== SUBSCRIPTIONS ==================
      case 'createSubscription': {
        const { customer, billingType, value, nextDueDate, cycle, description, externalReference } = params;
        result = await asaasRequest('/subscriptions', 'POST', {
          customer,
          billingType,
          value,
          nextDueDate,
          cycle,
          description,
          externalReference,
        });
        break;
      }

      case 'getSubscription': {
        const { subscriptionId } = params;
        result = await asaasRequest(`/subscriptions/${subscriptionId}`, 'GET');
        break;
      }

      case 'listSubscriptions': {
        const { customer, offset = 0, limit = 10 } = params;
        let url = `/subscriptions?offset=${offset}&limit=${limit}`;
        if (customer) url += `&customer=${customer}`;
        result = await asaasRequest(url, 'GET');
        break;
      }

      case 'updateSubscription': {
        const { subscriptionId, ...updateData } = params;
        result = await asaasRequest(`/subscriptions/${subscriptionId}`, 'PUT', updateData);
        break;
      }

      case 'cancelSubscription': {
        const { subscriptionId } = params;
        result = await asaasRequest(`/subscriptions/${subscriptionId}`, 'DELETE');
        break;
      }

      // ================== PAYMENTS ==================
      case 'createPayment': {
        const { customer, billingType, value, dueDate, description, externalReference } = params;
        result = await asaasRequest('/payments', 'POST', {
          customer,
          billingType,
          value,
          dueDate,
          description,
          externalReference,
        });
        break;
      }

      case 'getPayment': {
        const { paymentId } = params;
        result = await asaasRequest(`/payments/${paymentId}`, 'GET');
        break;
      }

      case 'listPayments': {
        const { customer, subscription, status, offset = 0, limit = 10 } = params;
        let url = `/payments?offset=${offset}&limit=${limit}`;
        if (customer) url += `&customer=${customer}`;
        if (subscription) url += `&subscription=${subscription}`;
        if (status) url += `&status=${status}`;
        result = await asaasRequest(url, 'GET');
        break;
      }

      case 'getPixQrCode': {
        const { paymentId } = params;
        result = await asaasRequest(`/payments/${paymentId}/pixQrCode`, 'GET');
        break;
      }

      case 'getBoletoUrl': {
        const { paymentId } = params;
        result = await asaasRequest(`/payments/${paymentId}/bankSlipBarCode`, 'GET');
        break;
      }

      case 'cancelPayment': {
        const { paymentId } = params;
        result = await asaasRequest(`/payments/${paymentId}`, 'DELETE');
        break;
      }

      // ================== CREDIT CARD ==================
      case 'tokenizeCreditCard': {
        const { customer, creditCard, creditCardHolderInfo } = params;
        result = await asaasRequest('/creditCard/tokenize', 'POST', {
          customer,
          creditCard,
          creditCardHolderInfo,
        });
        break;
      }

      case 'createPaymentWithCard': {
        const { customer, value, dueDate, description, externalReference, creditCard, creditCardHolderInfo, creditCardToken } = params;
        const paymentData: any = {
          customer,
          billingType: 'CREDIT_CARD',
          value,
          dueDate,
          description,
          externalReference,
        };
        
        if (creditCardToken) {
          paymentData.creditCardToken = creditCardToken;
        } else if (creditCard && creditCardHolderInfo) {
          paymentData.creditCard = creditCard;
          paymentData.creditCardHolderInfo = creditCardHolderInfo;
        }
        
        result = await asaasRequest('/payments', 'POST', paymentData);
        break;
      }

      // ================== INVOICES ==================
      case 'getInvoice': {
        const { paymentId } = params;
        result = await asaasRequest(`/payments/${paymentId}/invoiceUrl`, 'GET');
        break;
      }

      default:
        throw new Error(`Ação não suportada: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[Asaas API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
