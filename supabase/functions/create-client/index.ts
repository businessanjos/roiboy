import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface CreateClientPayload {
  account_id: string;
  phone_e164: string;
  full_name: string;
  emails?: string[];
  cpf?: string;
  cnpj?: string;
  company_name?: string;
  tags?: string[];
  notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: CreateClientPayload = await req.json();
    console.log("Create client request:", { ...payload, phone_e164: payload.phone_e164 });

    // Validate required fields
    if (!payload.account_id || !payload.phone_e164 || !payload.full_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: account_id, phone_e164, full_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate phone format
    if (!payload.phone_e164.match(/^\+[1-9]\d{6,14}$/)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone format. Use E.164 format (e.g., +5511999999999)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if client already exists with this phone
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id, full_name")
      .eq("phone_e164", payload.phone_e164)
      .eq("account_id", payload.account_id)
      .maybeSingle();

    if (existingClient) {
      return new Response(
        JSON.stringify({ 
          error: "Client already exists",
          existing_client: {
            id: existingClient.id,
            full_name: existingClient.full_name,
          }
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate account exists
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", payload.account_id)
      .maybeSingle();

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ error: "Invalid account_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the client
    const { data: newClient, error: createError } = await supabase
      .from("clients")
      .insert({
        account_id: payload.account_id,
        phone_e164: payload.phone_e164,
        full_name: payload.full_name,
        emails: payload.emails || [],
        cpf: payload.cpf || null,
        cnpj: payload.cnpj || null,
        company_name: payload.company_name || null,
        tags: payload.tags || [],
        notes: payload.notes || null,
        status: "active",
      })
      .select("id, full_name, phone_e164, status")
      .single();

    if (createError) {
      console.error("Error creating client:", createError);
      return new Response(
        JSON.stringify({ error: "Failed to create client", details: createError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Client created:", newClient.id, newClient.full_name);

    return new Response(
      JSON.stringify({
        success: true,
        client: newClient,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in create-client:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
