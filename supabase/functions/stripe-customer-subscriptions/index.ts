import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Stripe not configured', subscriptions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const { email, emails } = await req.json();
    console.log('Looking up Stripe subscriptions for:', { email, emails });
    
    // Build list of emails to search
    const emailsToSearch: string[] = [];
    if (email) emailsToSearch.push(email);
    if (emails && Array.isArray(emails)) {
      emails.forEach((e: { email: string }) => {
        if (e.email) emailsToSearch.push(e.email);
      });
    }

    if (emailsToSearch.length === 0) {
      return new Response(
        JSON.stringify({ subscriptions: [], message: 'No emails provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const allSubscriptions: any[] = [];
    const seenSubscriptionIds = new Set<string>();

    // Search for customers by each email
    for (const searchEmail of emailsToSearch) {
      try {
        const customers = await stripe.customers.list({
          email: searchEmail,
          limit: 10,
        });

        console.log(`Found ${customers.data.length} customers for email: ${searchEmail}`);

        for (const customer of customers.data) {
          // Get subscriptions for this customer
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            limit: 100,
            expand: ['data.items.data.price.product'],
          });

          for (const sub of subscriptions.data) {
            // Avoid duplicates
            if (seenSubscriptionIds.has(sub.id)) continue;
            seenSubscriptionIds.add(sub.id);

            // Extract product info
            const items = sub.items.data.map((item: any) => {
              const product = item.price.product as Stripe.Product;
              return {
                id: item.id,
                price_id: item.price.id,
                product_name: typeof product === 'string' ? product : product.name,
                product_description: typeof product === 'string' ? null : product.description,
                unit_amount: item.price.unit_amount,
                currency: item.price.currency,
                interval: item.price.recurring?.interval || null,
                interval_count: item.price.recurring?.interval_count || 1,
                quantity: item.quantity,
              };
            });

            allSubscriptions.push({
              id: sub.id,
              status: sub.status,
              customer_email: customer.email,
              customer_name: customer.name,
              current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              cancel_at_period_end: sub.cancel_at_period_end,
              canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
              created: new Date(sub.created * 1000).toISOString(),
              items,
            });
          }
        }
      } catch (customerError) {
        console.error(`Error searching customers for ${searchEmail}:`, customerError);
      }
    }

    console.log(`Found ${allSubscriptions.length} total subscriptions`);

    return new Response(
      JSON.stringify({ subscriptions: allSubscriptions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching Stripe subscriptions:', error);
    return new Response(
      JSON.stringify({ error: errorMessage, subscriptions: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});