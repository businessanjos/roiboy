import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PipedriveDeal {
  id: number;
  title: string;
  value: number;
  currency: string;
  status: string;
  person_id: number | null;
  org_id: number | null;
  won_time: string;
}

interface PipedrivePerson {
  id: number;
  name: string;
  phone: Array<{ value: string; primary: boolean }>;
  email: Array<{ value: string; primary: boolean }>;
}

interface PipedriveOrganization {
  id: number;
  name: string;
  address: string;
  address_locality: string;
  address_admin_area_level_1: string;
  address_postal_code: string;
  address_country: string;
}

interface PipedriveWebhookPayload {
  v: number;
  matches_filters: { current: Array<{ id: number }> };
  meta: {
    action: string;
    object: string;
    id: number;
    company_id: number;
    user_id: number;
    host: string;
    timestamp: number;
    permitted_user_ids: number[];
    trans_pending: boolean;
    is_bulk_update: boolean;
    pipedrive_service_name: string;
    matches_filters: { current: number[] };
    webhook_id: string;
  };
  current: PipedriveDeal;
  previous: PipedriveDeal | null;
  event: string;
  retry: number;
}

serve(async (req) => {
  console.log("Pipedrive webhook received:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Parse webhook payload
    const payload: PipedriveWebhookPayload = await req.json();
    console.log("Pipedrive webhook payload:", JSON.stringify(payload, null, 2));

    // Extract account_id from query params
    const url = new URL(req.url);
    const accountId = url.searchParams.get("account_id");

    if (!accountId) {
      console.error("Missing account_id in query params");
      return new Response(
        JSON.stringify({ error: "Missing account_id parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only process won deals
    const deal = payload.current;
    if (!deal || deal.status !== "won") {
      console.log("Ignoring non-won deal or empty payload");
      return new Response(
        JSON.stringify({ message: "Ignored - not a won deal" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing won deal: ${deal.title} (ID: ${deal.id})`);

    // Extract person and organization data from the webhook payload
    // Pipedrive sends nested data in some webhook configurations
    const personData = (payload as any).current?.person_id?.value || (payload as any).current?.person_id;
    const orgData = (payload as any).current?.org_id?.value || (payload as any).current?.org_id;

    // Build client data
    let clientName = deal.title;
    let phone = "";
    let emails: string[] = [];
    let companyName = "";
    let street = "";
    let city = "";
    let state = "";
    let zipCode = "";

    // If person data is an object with details
    if (personData && typeof personData === "object") {
      clientName = personData.name || deal.title;
      
      if (personData.phone && Array.isArray(personData.phone)) {
        const primaryPhone = personData.phone.find((p: any) => p.primary) || personData.phone[0];
        phone = primaryPhone?.value || "";
      }
      
      if (personData.email && Array.isArray(personData.email)) {
        emails = personData.email.map((e: any) => e.value).filter(Boolean);
      }
    }

    // If organization data is an object with details
    if (orgData && typeof orgData === "object") {
      companyName = orgData.name || "";
      street = orgData.address || "";
      city = orgData.address_locality || "";
      state = orgData.address_admin_area_level_1 || "";
      zipCode = orgData.address_postal_code || "";
    }

    // Format phone to E.164 (Brazilian format assumed)
    let phoneE164 = phone.replace(/\D/g, "");
    if (phoneE164 && !phoneE164.startsWith("55")) {
      phoneE164 = "55" + phoneE164;
    }
    if (phoneE164 && !phoneE164.startsWith("+")) {
      phoneE164 = "+" + phoneE164;
    }

    // If no phone, generate a placeholder (required field)
    if (!phoneE164) {
      phoneE164 = `+55000${deal.id}`;
      console.log(`No phone found, using placeholder: ${phoneE164}`);
    }

    console.log(`Client data: name=${clientName}, phone=${phoneE164}, emails=${emails.join(",")}, company=${companyName}`);

    // Check if client already exists by phone
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("account_id", accountId)
      .eq("phone_e164", phoneE164)
      .maybeSingle();

    let clientId: string;

    if (existingClient) {
      clientId = existingClient.id;
      console.log(`Client already exists: ${clientId}`);
      
      // Update client with new data from Pipedrive
      await supabase
        .from("clients")
        .update({
          full_name: clientName,
          emails: emails.length > 0 ? emails : undefined,
          company_name: companyName || undefined,
          street: street || undefined,
          city: city || undefined,
          state: state || undefined,
          zip_code: zipCode || undefined,
        })
        .eq("id", clientId);
    } else {
      // Create new client
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          account_id: accountId,
          full_name: clientName,
          phone_e164: phoneE164,
          emails: emails.length > 0 ? emails : [],
          company_name: companyName || null,
          street: street || null,
          city: city || null,
          state: state || null,
          zip_code: zipCode || null,
          notes: `Importado do Pipedrive - Deal: ${deal.title} (ID: ${deal.id})`,
          status: "active",
        })
        .select("id")
        .single();

      if (clientError) {
        console.error("Error creating client:", clientError);
        throw clientError;
      }

      clientId = newClient.id;
      console.log(`Created new client: ${clientId}`);
    }

    // Create subscription if deal has value
    if (deal.value > 0) {
      const { error: subscriptionError } = await supabase
        .from("client_subscriptions")
        .insert({
          account_id: accountId,
          client_id: clientId,
          product_name: deal.title,
          amount: deal.value,
          currency: deal.currency || "BRL",
          payment_status: "active",
          billing_period: "monthly",
          start_date: deal.won_time ? new Date(deal.won_time).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        });

      if (subscriptionError) {
        console.error("Error creating subscription:", subscriptionError);
        // Don't throw - client was created successfully
      } else {
        console.log(`Created subscription for client ${clientId}`);
      }
    }

    // Create ROI event for the sale
    const { error: roiError } = await supabase
      .from("roi_events")
      .insert({
        account_id: accountId,
        client_id: clientId,
        roi_type: "tangible",
        category: "revenue",
        impact: deal.value >= 10000 ? "high" : deal.value >= 1000 ? "medium" : "low",
        source: "manual",
        happened_at: deal.won_time || new Date().toISOString(),
        evidence_snippet: `Venda fechada no Pipedrive: ${deal.title} - Valor: ${deal.currency || "BRL"} ${deal.value.toLocaleString("pt-BR")}`,
      });

    if (roiError) {
      console.error("Error creating ROI event:", roiError);
    } else {
      console.log(`Created ROI event for client ${clientId}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Client created/updated successfully",
        client_id: clientId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing Pipedrive webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
