import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ryka-secret",
};

interface SalePayload {
  type: "sale";
  cpf_cnpj: string;
  sale_date: string;
  amount: number;
  currency?: string;
  description?: string;
  external_id?: string;
}

interface GoalPayload {
  type: "goal";
  cpf_cnpj: string;
  period_start: string;
  period_end: string;
  goal_amount: number;
  currency?: string;
  external_id?: string;
}

type WebhookPayload = SalePayload | GoalPayload;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const rykaSecret = Deno.env.get("RYKA_WEBHOOK_SECRET");
    
    // Validate webhook secret if configured
    const providedSecret = req.headers.get("x-ryka-secret");
    if (rykaSecret && providedSecret !== rykaSecret) {
      console.error("Invalid webhook secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload: WebhookPayload = await req.json();

    console.log("Received Ryka webhook:", JSON.stringify(payload));

    // Validate required fields
    if (!payload.type || !payload.cpf_cnpj) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, cpf_cnpj" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize CPF/CNPJ (remove formatting)
    const normalizedDoc = payload.cpf_cnpj.replace(/\D/g, "");

    // Find client by CPF or CNPJ
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, account_id, full_name")
      .or(`cpf.eq.${normalizedDoc},cnpj.eq.${normalizedDoc}`)
      .maybeSingle();

    if (clientError) {
      console.error("Error finding client:", clientError);
      return new Response(
        JSON.stringify({ error: "Database error finding client" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!client) {
      console.log(`No client found for CPF/CNPJ: ${normalizedDoc}`);
      return new Response(
        JSON.stringify({ error: "Client not found", cpf_cnpj: normalizedDoc }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found client: ${client.full_name} (${client.id})`);

    if (payload.type === "sale") {
      const salePayload = payload as SalePayload;
      
      // Validate sale fields
      if (!salePayload.sale_date || salePayload.amount === undefined) {
        return new Response(
          JSON.stringify({ error: "Missing required fields for sale: sale_date, amount" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if sale already exists (by external_id)
      if (salePayload.external_id) {
        const { data: existingSale } = await supabase
          .from("sales_records")
          .select("id")
          .eq("external_id", salePayload.external_id)
          .eq("client_id", client.id)
          .maybeSingle();

        if (existingSale) {
          console.log(`Sale already exists: ${salePayload.external_id}`);
          return new Response(
            JSON.stringify({ success: true, message: "Sale already recorded", id: existingSale.id }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Insert sale record
      const { data: sale, error: saleError } = await supabase
        .from("sales_records")
        .insert({
          account_id: client.account_id,
          client_id: client.id,
          sale_date: salePayload.sale_date,
          amount: salePayload.amount,
          currency: salePayload.currency || "BRL",
          description: salePayload.description || null,
          external_id: salePayload.external_id || null,
        })
        .select()
        .single();

      if (saleError) {
        console.error("Error inserting sale:", saleError);
        return new Response(
          JSON.stringify({ error: "Failed to record sale" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Sale recorded: ${sale.id} - R$ ${salePayload.amount}`);

      // Create ROI event for the sale (revenue)
      await supabase.from("roi_events").insert({
        account_id: client.account_id,
        client_id: client.id,
        source: "financial",
        roi_type: "tangible",
        category: "revenue",
        impact: salePayload.amount >= 10000 ? "high" : salePayload.amount >= 1000 ? "medium" : "low",
        evidence_snippet: `Venda registrada: R$ ${salePayload.amount.toLocaleString('pt-BR')}${salePayload.description ? ` - ${salePayload.description}` : ''}`,
        happened_at: salePayload.sale_date,
      });

      return new Response(
        JSON.stringify({ success: true, type: "sale", id: sale.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (payload.type === "goal") {
      const goalPayload = payload as GoalPayload;
      
      // Validate goal fields
      if (!goalPayload.period_start || !goalPayload.period_end || goalPayload.goal_amount === undefined) {
        return new Response(
          JSON.stringify({ error: "Missing required fields for goal: period_start, period_end, goal_amount" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upsert goal (update if exists for same period)
      const { data: goal, error: goalError } = await supabase
        .from("sales_goals")
        .upsert({
          account_id: client.account_id,
          client_id: client.id,
          period_start: goalPayload.period_start,
          period_end: goalPayload.period_end,
          goal_amount: goalPayload.goal_amount,
          currency: goalPayload.currency || "BRL",
          external_id: goalPayload.external_id || null,
        }, {
          onConflict: "client_id,period_start,period_end",
        })
        .select()
        .single();

      if (goalError) {
        console.error("Error upserting goal:", goalError);
        return new Response(
          JSON.stringify({ error: "Failed to record goal" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Goal recorded: ${goal.id} - R$ ${goalPayload.goal_amount}`);

      return new Response(
        JSON.stringify({ success: true, type: "goal", id: goal.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid payload type. Expected 'sale' or 'goal'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in ryka-webhook:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
