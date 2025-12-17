import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const formId = url.searchParams.get("formId");
    const clientId = url.searchParams.get("clientId");

    if (!formId) {
      return new Response(
        JSON.stringify({ error: "formId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching form ${formId}, clientId: ${clientId || "none"}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch form
    const { data: form, error: formError } = await supabase
      .from("forms")
      .select("id, account_id, title, description, fields, is_active, require_client_info")
      .eq("id", formId)
      .eq("is_active", true)
      .maybeSingle();

    if (formError) {
      console.error("Error fetching form:", formError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch form" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!form) {
      return new Response(
        JSON.stringify({ error: "Form not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If clientId provided, verify it exists and belongs to same account
    let client = null;
    if (clientId) {
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id, full_name, phone_e164")
        .eq("id", clientId)
        .eq("account_id", form.account_id)
        .maybeSingle();

      if (clientError) {
        console.error("Error fetching client:", clientError);
      } else if (clientData) {
        client = {
          id: clientData.id,
          name: clientData.full_name,
          phone: clientData.phone_e164,
        };
      }
    }

    // Fetch custom fields for this account (to get field definitions)
    const { data: customFields, error: fieldsError } = await supabase
      .from("custom_fields")
      .select("id, name, field_type, options, is_required")
      .eq("account_id", form.account_id)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (fieldsError) {
      console.error("Error fetching custom fields:", fieldsError);
    }

    console.log(`Found form: ${form.title}, fields: ${customFields?.length || 0}`);

    return new Response(
      JSON.stringify({
        form: {
          id: form.id,
          title: form.title,
          description: form.description,
          fields: form.fields,
          require_client_info: form.require_client_info,
        },
        client,
        customFields: customFields || [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
