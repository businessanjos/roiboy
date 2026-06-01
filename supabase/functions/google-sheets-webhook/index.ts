import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BankTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  bank_account_id?: string;
  external_id?: string;
  category?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const expectedSecret = Deno.env.get('GOOGLE_SHEETS_WEBHOOK_SECRET');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fail-closed shared-secret validation
    if (!expectedSecret) {
      console.error('GOOGLE_SHEETS_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();
    const headerSecret = req.headers.get('x-webhook-secret');
    const providedSecret = headerSecret || payload?.webhook_secret;
    if (providedSecret !== expectedSecret) {
      console.error('Invalid webhook secret');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Webhook received (authenticated)');

    const {
      account_id,
      bank_account_id,
      event_type,
      transactions,
    } = payload;

    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', account_id)
      .single();

    if (!account) {
      console.error('Invalid account_id');
      return new Response(JSON.stringify({ error: 'Invalid account' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get or validate bank account
    let targetBankAccountId = bank_account_id;
    if (!targetBankAccountId) {
      // Try to find BTG account
      const { data: btgAccount } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('account_id', account_id)
        .ilike('bank_name', '%btg%')
        .eq('is_active', true)
        .limit(1)
        .single();
      
      if (btgAccount) {
        targetBankAccountId = btgAccount.id;
      }
    }

    const results = {
      processed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process transactions based on event type
    for (const tx of transactions || []) {
      try {
        // Check if transaction already exists (by external_id)
        if (tx.external_id) {
          const { data: existing } = await supabase
            .from('financial_entries')
            .select('id')
            .eq('account_id', account_id)
            .eq('external_id', tx.external_id)
            .limit(1)
            .single();

          if (existing) {
            console.log(`Transaction ${tx.external_id} already exists, skipping`);
            results.skipped++;
            continue;
          }
        }

        // Parse transaction data
        const entryType = tx.type === 'credit' || tx.amount > 0 ? 'income' : 'expense';
        const amount = Math.abs(parseFloat(tx.amount) || 0);
        const transactionDate = tx.date ? new Date(tx.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        // Insert financial entry
        const { error: insertError } = await supabase
          .from('financial_entries')
          .insert({
            account_id,
            bank_account_id: targetBankAccountId,
            description: tx.description || 'Movimentação bancária',
            amount,
            type: entryType,
            status: 'confirmed',
            due_date: transactionDate,
            payment_date: transactionDate,
            external_id: tx.external_id,
            notes: `Importado via Google Sheets - ${event_type || 'transaction'}`,
            source: 'google_sheets_webhook',
          });

        if (insertError) {
          console.error('Insert error:', insertError);
          results.errors.push(`Failed to insert: ${tx.description}`);
        } else {
          results.processed++;
          console.log(`Processed transaction: ${tx.description}`);
        }
      } catch (txError) {
        console.error('Transaction processing error:', txError);
        results.errors.push(`Error processing: ${tx.description}`);
      }
    }

    // Update bank account balance if needed
    if (targetBankAccountId && event_type === 'balance_update' && payload.balance !== undefined) {
      const { error: balanceError } = await supabase
        .from('bank_accounts')
        .update({ 
          current_balance: parseFloat(payload.balance),
          updated_at: new Date().toISOString()
        })
        .eq('id', targetBankAccountId);

      if (balanceError) {
        console.error('Balance update error:', balanceError);
      } else {
        console.log(`Updated balance to ${payload.balance}`);
      }
    }

    console.log('Webhook processing complete:', results);

    return new Response(JSON.stringify({
      success: true,
      ...results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
