import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

// Asaas payment status mapping
const PAYMENT_STATUS_MAP: Record<string, string> = {
  PENDING: 'pending',
  RECEIVED: 'active',
  CONFIRMED: 'active',
  OVERDUE: 'overdue',
  REFUNDED: 'cancelled',
  RECEIVED_IN_CASH: 'active',
  REFUND_REQUESTED: 'cancelled',
  CHARGEBACK_REQUESTED: 'cancelled',
  CHARGEBACK_DISPUTE: 'cancelled',
  AWAITING_CHARGEBACK_REVERSAL: 'cancelled',
  DUNNING_REQUESTED: 'overdue',
  DUNNING_RECEIVED: 'active',
  AWAITING_RISK_ANALYSIS: 'pending',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    console.log('[Asaas Webhook] Received event:', payload.event);
    console.log('[Asaas Webhook] Payment data:', JSON.stringify(payload.payment).substring(0, 500));

    const { event, payment } = payload;

    if (!payment) {
      console.log('[Asaas Webhook] No payment data in webhook');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get external reference (client_id or subscription_id from our system)
    const externalReference = payment.externalReference;
    const subscriptionId = payment.subscription;
    const asaasStatus = payment.status;
    const mappedStatus = PAYMENT_STATUS_MAP[asaasStatus] || 'pending';

    console.log(`[Asaas Webhook] External ref: ${externalReference}, Subscription: ${subscriptionId}, Status: ${asaasStatus} -> ${mappedStatus}`);

    // Handle subscription payments
    if (subscriptionId && externalReference) {
      // Try to find and update the subscription in our database
      const { data: subscription, error: findError } = await supabaseClient
        .from('client_subscriptions')
        .select('*')
        .eq('id', externalReference)
        .single();

      if (subscription) {
        console.log('[Asaas Webhook] Found subscription:', subscription.id);

        // Update subscription status based on payment
        const updateData: Record<string, any> = {
          payment_status: mappedStatus,
          updated_at: new Date().toISOString(),
        };

        // If payment received, update next billing date
        if (mappedStatus === 'active' && payment.paymentDate) {
          // Calculate next billing date based on billing period
          const paymentDate = new Date(payment.paymentDate);
          let nextBilling = new Date(paymentDate);
          
          switch (subscription.billing_period) {
            case 'monthly':
              nextBilling.setMonth(nextBilling.getMonth() + 1);
              break;
            case 'quarterly':
              nextBilling.setMonth(nextBilling.getMonth() + 3);
              break;
            case 'semiannual':
              nextBilling.setMonth(nextBilling.getMonth() + 6);
              break;
            case 'annual':
              nextBilling.setFullYear(nextBilling.getFullYear() + 1);
              break;
          }
          updateData.next_billing_date = nextBilling.toISOString().split('T')[0];
        }

        const { error: updateError } = await supabaseClient
          .from('client_subscriptions')
          .update(updateData)
          .eq('id', externalReference);

        if (updateError) {
          console.error('[Asaas Webhook] Error updating subscription:', updateError);
        } else {
          console.log('[Asaas Webhook] Subscription updated successfully');
        }
      } else {
        console.log('[Asaas Webhook] Subscription not found in database:', externalReference);
      }
    }

    // Handle contract payments
    if (externalReference && externalReference.startsWith('contract_')) {
      const contractId = externalReference.replace('contract_', '');
      
      const { error: updateError } = await supabaseClient
        .from('client_contracts')
        .update({
          status: mappedStatus === 'active' ? 'active' : mappedStatus === 'overdue' ? 'overdue' : 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', contractId);

      if (updateError) {
        console.error('[Asaas Webhook] Error updating contract:', updateError);
      } else {
        console.log('[Asaas Webhook] Contract updated successfully');
      }
    }

    // Log the webhook event for debugging
    console.log('[Asaas Webhook] Processed successfully');

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[Asaas Webhook] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
