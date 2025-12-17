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
    const body = await req.json();
    const { formId, clientId, clientName, clientPhone, responses } = body;

    if (!formId) {
      return new Response(
        JSON.stringify({ error: "formId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!responses || typeof responses !== "object") {
      return new Response(
        JSON.stringify({ error: "responses is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Submitting response for form ${formId}, client: ${clientId || clientName || "unknown"}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch form to get account_id, title and validate
    const { data: form, error: formError } = await supabase
      .from("forms")
      .select("id, account_id, is_active, require_client_info, title")
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

    // If require_client_info and no clientId, we need name and phone
    if (form.require_client_info && !clientId) {
      if (!clientName || !clientPhone) {
        return new Response(
          JSON.stringify({ error: "Client name and phone are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let resolvedClientId = clientId;

    // If clientId provided, verify it exists
    if (clientId) {
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id")
        .eq("id", clientId)
        .eq("account_id", form.account_id)
        .maybeSingle();

      if (clientError || !clientData) {
        console.warn("Client not found, proceeding without linking");
        resolvedClientId = null;
      }
    }

    // Try to find existing client by phone if not provided
    if (!resolvedClientId && clientPhone) {
      // Normalize phone
      let normalizedPhone = clientPhone.replace(/\D/g, "");
      if (!normalizedPhone.startsWith("+")) {
        if (normalizedPhone.length === 11 || normalizedPhone.length === 10) {
          normalizedPhone = "+55" + normalizedPhone;
        } else {
          normalizedPhone = "+" + normalizedPhone;
        }
      }

      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("account_id", form.account_id)
        .eq("phone_e164", normalizedPhone)
        .maybeSingle();

      if (existingClient) {
        resolvedClientId = existingClient.id;
        console.log(`Found existing client by phone: ${resolvedClientId}`);
      }
    }

    // Insert form response
    const { data: response, error: insertError } = await supabase
      .from("form_responses")
      .insert({
        account_id: form.account_id,
        form_id: formId,
        client_id: resolvedClientId,
        client_name: clientName || null,
        client_phone: clientPhone || null,
        responses,
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error inserting response:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to submit response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Response submitted successfully: ${response.id}`);

    // Mark form send as responded if client linked
    if (resolvedClientId) {
      const { error: updateSendError } = await supabase
        .from("client_form_sends")
        .update({ responded_at: new Date().toISOString() })
        .eq("client_id", resolvedClientId)
        .eq("form_id", formId)
        .is("responded_at", null);

      if (updateSendError) {
        console.warn("Could not update form send status:", updateSendError);
      } else {
        console.log(`Marked form send as responded for client ${resolvedClientId}`);
      }
    }

    // Create notifications for all users in the account
    try {
      // Get all users in the account
      const { data: accountUsers, error: usersError } = await supabase
        .from("users")
        .select("id")
        .eq("account_id", form.account_id);

      if (!usersError && accountUsers && accountUsers.length > 0) {
        // Get client name for notification
        let notificationClientName = clientName || "Cliente";
        if (resolvedClientId) {
          const { data: clientData } = await supabase
            .from("clients")
            .select("full_name")
            .eq("id", resolvedClientId)
            .maybeSingle();
          
          if (clientData?.full_name) {
            notificationClientName = clientData.full_name;
          }
        }

        // Create notification for each user
        const notifications = accountUsers.map((user: { id: string }) => ({
          account_id: form.account_id,
          user_id: user.id,
          type: "form_response",
          title: "Nova resposta de formulário",
          content: `${notificationClientName} respondeu ao formulário "${form.title}"`,
          link: resolvedClientId ? `/clients/${resolvedClientId}` : "/forms",
          source_type: "form_response",
          source_id: response.id,
        }));

        const { error: notifyError } = await supabase
          .from("notifications")
          .insert(notifications);

        if (notifyError) {
          console.warn("Could not create notifications:", notifyError);
        } else {
          console.log(`Created ${notifications.length} notifications for form response`);
        }
      }
    } catch (notifyErr) {
      console.warn("Error creating notifications:", notifyErr);
    }

    return new Response(
      JSON.stringify({ success: true, responseId: response.id }),
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
