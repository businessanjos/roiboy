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

    console.log("Starting contract expiry check...");

    const today = new Date();
    const in30Days = new Date(today);
    in30Days.setDate(today.getDate() + 30);
    const in60Days = new Date(today);
    in60Days.setDate(today.getDate() + 60);

    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    // Find contracts expiring in exactly 30 or 60 days
    const { data: expiringClients, error: clientsError } = await supabase
      .from("clients")
      .select("id, full_name, account_id, contract_end_date")
      .or(`contract_end_date.eq.${formatDate(in30Days)},contract_end_date.eq.${formatDate(in60Days)}`);

    if (clientsError) {
      console.error("Error fetching clients:", clientsError);
      throw clientsError;
    }

    console.log(`Found ${expiringClients?.length || 0} clients with expiring contracts`);

    if (!expiringClients || expiringClients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No expiring contracts found", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let notificationsCreated = 0;

    for (const client of expiringClients) {
      const endDate = new Date(client.contract_end_date);
      const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`Processing client ${client.full_name} - ${daysUntilExpiry} days until expiry`);

      // Get all users in the same account
      const { data: accountUsers, error: usersError } = await supabase
        .from("users")
        .select("id")
        .eq("account_id", client.account_id);

      if (usersError) {
        console.error(`Error fetching users for account ${client.account_id}:`, usersError);
        continue;
      }

      if (!accountUsers || accountUsers.length === 0) {
        console.log(`No users found for account ${client.account_id}`);
        continue;
      }

      // Check if notification already exists for this client and expiry period
      const notificationTitle = daysUntilExpiry <= 30 
        ? `Contrato expira em ${daysUntilExpiry} dias` 
        : `Contrato expira em ${daysUntilExpiry} dias`;
      
      const sourceId = `contract-expiry-${client.id}-${daysUntilExpiry <= 35 ? '30' : '60'}`;

      for (const user of accountUsers) {
        // Check if notification already sent today for this client/user/period
        const { data: existingNotification } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", user.id)
          .eq("source_type", "contract_expiry")
          .eq("source_id", sourceId)
          .gte("created_at", formatDate(today))
          .limit(1);

        if (existingNotification && existingNotification.length > 0) {
          console.log(`Notification already sent to user ${user.id} for client ${client.full_name}`);
          continue;
        }

        // Create notification
        const { error: notifyError } = await supabase
          .from("notifications")
          .insert({
            account_id: client.account_id,
            user_id: user.id,
            title: notificationTitle,
            content: `O contrato de ${client.full_name} expira em ${new Date(client.contract_end_date).toLocaleDateString("pt-BR")}. ${daysUntilExpiry <= 30 ? "Urgente: menos de 30 dias!" : "Planeje a renovação."}`,
            type: daysUntilExpiry <= 30 ? "contract_expiry_urgent" : "contract_expiry_warning",
            link: `/clients/${client.id}`,
            source_type: "contract_expiry",
            source_id: sourceId,
          });

        if (notifyError) {
          console.error(`Error creating notification for user ${user.id}:`, notifyError);
        } else {
          notificationsCreated++;
          console.log(`Notification created for user ${user.id} about client ${client.full_name}`);
        }
      }
    }

    console.log(`Contract expiry check completed. ${notificationsCreated} notifications created.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Contract expiry check completed",
        clientsChecked: expiringClients.length,
        notificationsCreated 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in check-contract-expiry:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
