import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting contract renewal deals check...");

    const today = new Date();
    const in40Days = new Date(today);
    in40Days.setDate(today.getDate() + 40);

    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    // Find active contracts that are expired OR expiring within 40 days
    // Include contracts that expired up to 120 days ago (to catch overdue renewals)
    const past120Days = new Date(today);
    past120Days.setDate(today.getDate() - 120);

    const { data: expiringContracts, error: contractsError } = await supabase
      .from("client_contracts")
      .select(`
        id,
        account_id,
        client_id,
        value,
        currency,
        end_date,
        product_id,
        clients!inner(full_name)
      `)
      .eq("status", "active")
      .not("end_date", "is", null)
      .gte("end_date", formatDate(past120Days))
      .lte("end_date", formatDate(in40Days));

    if (contractsError) {
      console.error("Error fetching contracts:", contractsError);
      throw contractsError;
    }

    console.log(`Found ${expiringContracts?.length || 0} contracts expiring within 40 days`);

    if (!expiringContracts || expiringContracts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No expiring contracts found", dealsCreated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let dealsCreated = 0;
    let dealsSkipped = 0;

    for (const contract of expiringContracts) {
      const clientName = (contract.clients as any)?.full_name || "Cliente";
      
      console.log(`Processing contract ${contract.id} for client ${clientName}`);

      // Check if renewal deal already exists for this client (open deal with renovação tag or source)
      const { data: existingDeals, error: dealsError } = await supabase
        .from("deals")
        .select("id, source, tags")
        .eq("client_id", contract.client_id)
        .eq("status", "open")
        .limit(50);

      if (dealsError) {
        console.error(`Error checking existing deals for client ${contract.client_id}:`, dealsError);
        continue;
      }

      // Filter for renewal deals in code (to avoid JSONB query issues with special chars)
      const hasRenewalDeal = existingDeals?.some(d => 
        d.source === 'contract_renewal' || 
        (Array.isArray(d.tags) && d.tags.some((t: string) => t.toLowerCase().includes('renova')))
      );

      if (hasRenewalDeal) {
        console.log(`Renewal deal already exists for client ${clientName}, skipping`);
        dealsSkipped++;
        continue;
      }

      // Also check if there's a deal linked to this specific contract
      const { data: linkedDeals, error: linkedError } = await supabase
        .from("deals")
        .select("id")
        .eq("source_contract_id", contract.id)
        .eq("status", "open")
        .limit(1);

      if (linkedError) {
        console.error(`Error checking linked deals for contract ${contract.id}:`, linkedError);
        continue;
      }

      if (linkedDeals && linkedDeals.length > 0) {
        console.log(`Deal already linked to contract ${contract.id}, skipping`);
        dealsSkipped++;
        continue;
      }

      // Get the first deal stage for this account
      const { data: stages, error: stagesError } = await supabase
        .from("deal_stages")
        .select("id")
        .eq("account_id", contract.account_id)
        .order("display_order", { ascending: true })
        .limit(1);

      if (stagesError || !stages || stages.length === 0) {
        console.error(`No deal stages found for account ${contract.account_id}`);
        continue;
      }

      const endDate = new Date(contract.end_date);
      const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const isExpired = daysUntilExpiry < 0;
      const urgencyLabel = isExpired 
        ? `VENCIDO há ${Math.abs(daysUntilExpiry)} dias` 
        : `Vence em ${daysUntilExpiry} dias`;

      // Create renewal deal
      const { data: newDeal, error: createError } = await supabase
        .from("deals")
        .insert({
          account_id: contract.account_id,
          title: `[RENOVAÇÃO] ${clientName}`,
          client_id: contract.client_id,
          stage_id: stages[0].id,
          value: contract.value || 0,
          currency: contract.currency || "BRL",
          source: "contract_renewal",
          source_contract_id: contract.id,
          tags: isExpired ? ["renovação", "vencido"] : ["renovação"],
          notes: `Renovação automática do contrato que ${isExpired ? 'venceu' : 'vence'} em ${endDate.toLocaleDateString("pt-BR")}.\n\n${urgencyLabel}\nContrato original: ${contract.id}`,
          expected_close_date: isExpired ? formatDate(today) : contract.end_date,
          status: "open",
        })
        .select()
        .single();

      if (createError) {
        console.error(`Error creating deal for client ${clientName}:`, createError);
        continue;
      }

      console.log(`Created renewal deal ${newDeal.id} for client ${clientName}`);
      dealsCreated++;

      // Create notification for users in the sales sector
      const { data: salesUsers, error: usersError } = await supabase
        .from("user_sector_access")
        .select("user_id")
        .eq("account_id", contract.account_id)
        .eq("sector_id", "vendas");

      if (usersError) {
        console.error(`Error fetching sales users:`, usersError);
      } else if (salesUsers && salesUsers.length > 0) {
        const notifications = salesUsers.map((user) => ({
          account_id: contract.account_id,
          user_id: user.user_id,
          title: `Nova renovação: ${clientName}`,
          content: `O contrato de ${clientName} vence em ${daysUntilExpiry} dias. Um negócio de renovação foi criado automaticamente.`,
          type: "deal_renewal",
          link: `/pipeline`,
          source_type: "contract_renewal",
          source_id: newDeal.id,
        }));

        const { error: notifyError } = await supabase
          .from("notifications")
          .insert(notifications);

        if (notifyError) {
          console.error(`Error creating notifications:`, notifyError);
        } else {
          console.log(`Created ${notifications.length} notifications for sales users`);
        }
      }
    }

    console.log(`Contract renewal check completed. Created: ${dealsCreated}, Skipped: ${dealsSkipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Contract renewal check completed",
        contractsChecked: expiringContracts.length,
        dealsCreated,
        dealsSkipped,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in check-contract-renewal-deals:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
