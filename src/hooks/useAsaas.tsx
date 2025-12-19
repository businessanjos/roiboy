import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Types for Asaas API
export interface AsaasCustomer {
  id?: string;
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
  externalReference?: string;
}

export interface AsaasSubscription {
  id?: string;
  customer: string;
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
  value: number;
  nextDueDate: string;
  cycle: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  description?: string;
  externalReference?: string;
  status?: string;
}

export interface AsaasPayment {
  id?: string;
  customer: string;
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
  status?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCodeUrl?: string;
}

export interface AsaasCreditCard {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface AsaasCreditCardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone: string;
}

export interface AsaasApiResponse<T = any> {
  data?: T;
  totalCount?: number;
  hasMore?: boolean;
  error?: string;
}

// Billing type labels
export const BILLING_TYPE_LABELS: Record<string, string> = {
  BOLETO: 'Boleto',
  CREDIT_CARD: 'Cartão de Crédito',
  PIX: 'PIX',
  UNDEFINED: 'A definir',
};

// Cycle labels
export const CYCLE_LABELS: Record<string, string> = {
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
  BIMONTHLY: 'Bimestral',
  QUARTERLY: 'Trimestral',
  SEMIANNUALLY: 'Semestral',
  YEARLY: 'Anual',
};

// Payment status labels
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  RECEIVED: 'Recebido',
  CONFIRMED: 'Confirmado',
  OVERDUE: 'Vencido',
  REFUNDED: 'Estornado',
  RECEIVED_IN_CASH: 'Recebido em dinheiro',
  REFUND_REQUESTED: 'Estorno solicitado',
  CHARGEBACK_REQUESTED: 'Chargeback solicitado',
  CHARGEBACK_DISPUTE: 'Em disputa',
  AWAITING_CHARGEBACK_REVERSAL: 'Aguardando reversão',
  DUNNING_REQUESTED: 'Em cobrança',
  DUNNING_RECEIVED: 'Cobrança recebida',
  AWAITING_RISK_ANALYSIS: 'Em análise',
};

export function useAsaas() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callAsaasApi = useCallback(async <T = any>(action: string, params: object = {}): Promise<AsaasApiResponse<T>> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('asaas-api', {
        body: { action, ...params },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return { data };
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao conectar com o Asaas';
      setError(errorMessage);
      return { error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // ================== CUSTOMERS ==================
  const createCustomer = useCallback(async (customer: AsaasCustomer) => {
    return callAsaasApi<AsaasCustomer>('createCustomer', customer);
  }, [callAsaasApi]);

  const getCustomer = useCallback(async (customerId: string) => {
    return callAsaasApi<AsaasCustomer>('getCustomer', { customerId });
  }, [callAsaasApi]);

  const findCustomerByCpfCnpj = useCallback(async (cpfCnpj: string) => {
    return callAsaasApi<{ data: AsaasCustomer[] }>('findCustomerByCpfCnpj', { cpfCnpj });
  }, [callAsaasApi]);

  const listCustomers = useCallback(async (offset = 0, limit = 10) => {
    return callAsaasApi<{ data: AsaasCustomer[]; totalCount: number }>('listCustomers', { offset, limit });
  }, [callAsaasApi]);

  // ================== SUBSCRIPTIONS ==================
  const createSubscription = useCallback(async (subscription: Omit<AsaasSubscription, 'id'>) => {
    return callAsaasApi<AsaasSubscription>('createSubscription', subscription);
  }, [callAsaasApi]);

  const getSubscription = useCallback(async (subscriptionId: string) => {
    return callAsaasApi<AsaasSubscription>('getSubscription', { subscriptionId });
  }, [callAsaasApi]);

  const listSubscriptions = useCallback(async (customer?: string, offset = 0, limit = 10) => {
    return callAsaasApi<{ data: AsaasSubscription[]; totalCount: number }>('listSubscriptions', { customer, offset, limit });
  }, [callAsaasApi]);

  const updateSubscription = useCallback(async (subscriptionId: string, updates: Partial<AsaasSubscription>) => {
    return callAsaasApi<AsaasSubscription>('updateSubscription', { subscriptionId, ...updates });
  }, [callAsaasApi]);

  const cancelSubscription = useCallback(async (subscriptionId: string) => {
    return callAsaasApi('cancelSubscription', { subscriptionId });
  }, [callAsaasApi]);

  // ================== PAYMENTS ==================
  const createPayment = useCallback(async (payment: Omit<AsaasPayment, 'id'>) => {
    return callAsaasApi<AsaasPayment>('createPayment', payment);
  }, [callAsaasApi]);

  const getPayment = useCallback(async (paymentId: string) => {
    return callAsaasApi<AsaasPayment>('getPayment', { paymentId });
  }, [callAsaasApi]);

  const listPayments = useCallback(async (filters: { customer?: string; subscription?: string; status?: string; offset?: number; limit?: number } = {}) => {
    return callAsaasApi<{ data: AsaasPayment[]; totalCount: number }>('listPayments', filters);
  }, [callAsaasApi]);

  const getPixQrCode = useCallback(async (paymentId: string) => {
    return callAsaasApi<{ encodedImage: string; payload: string; expirationDate: string }>('getPixQrCode', { paymentId });
  }, [callAsaasApi]);

  const getBoletoUrl = useCallback(async (paymentId: string) => {
    return callAsaasApi<{ barCode: string; identificationField: string }>('getBoletoUrl', { paymentId });
  }, [callAsaasApi]);

  const cancelPayment = useCallback(async (paymentId: string) => {
    return callAsaasApi('cancelPayment', { paymentId });
  }, [callAsaasApi]);

  const getInvoice = useCallback(async (paymentId: string) => {
    return callAsaasApi<string>('getInvoice', { paymentId });
  }, [callAsaasApi]);

  // ================== CREDIT CARD ==================
  const tokenizeCreditCard = useCallback(async (
    customer: string,
    creditCard: AsaasCreditCard,
    creditCardHolderInfo: AsaasCreditCardHolderInfo
  ) => {
    return callAsaasApi<{ creditCardToken: string; creditCardNumber: string; creditCardBrand: string }>('tokenizeCreditCard', {
      customer,
      creditCard,
      creditCardHolderInfo,
    });
  }, [callAsaasApi]);

  const createPaymentWithCard = useCallback(async (payment: {
    customer: string;
    value: number;
    dueDate: string;
    description?: string;
    externalReference?: string;
    creditCard?: AsaasCreditCard;
    creditCardHolderInfo?: AsaasCreditCardHolderInfo;
    creditCardToken?: string;
  }) => {
    return callAsaasApi<AsaasPayment>('createPaymentWithCard', payment);
  }, [callAsaasApi]);

  return {
    loading,
    error,
    // Customers
    createCustomer,
    getCustomer,
    findCustomerByCpfCnpj,
    listCustomers,
    // Subscriptions
    createSubscription,
    getSubscription,
    listSubscriptions,
    updateSubscription,
    cancelSubscription,
    // Payments
    createPayment,
    getPayment,
    listPayments,
    getPixQrCode,
    getBoletoUrl,
    cancelPayment,
    getInvoice,
    // Credit Card
    tokenizeCreditCard,
    createPaymentWithCard,
  };
}
