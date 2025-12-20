import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit configuration
const RATE_LIMIT_MAX_REQUESTS = 5; // Max form submissions per window
const RATE_LIMIT_WINDOW_SECONDS = 60; // 1 minute window

// Input validation functions
function validateUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

function validatePhone(phone: string): boolean {
  if (!phone) return true; // Optional field
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function validateName(name: string): boolean {
  if (!name) return true; // Optional field
  return name.length >= 2 && name.length <= 200;
}

function sanitizeString(input: string): string {
  if (!input) return input;
  // Remove potential XSS characters but allow basic punctuation
  return input.replace(/[<>]/g, '').trim().substring(0, 1000);
}

function sanitizeResponses(responses: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(responses)) {
    const sanitizedKey = sanitizeString(key).substring(0, 100);
    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeString(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[sanitizedKey] = value;
    } else if (Array.isArray(value)) {
      sanitized[sanitizedKey] = value.map(v => 
        typeof v === 'string' ? sanitizeString(v) : v
      ).slice(0, 100);
    }
    // Skip other types for security
  }
  return sanitized;
}

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         req.headers.get('x-real-ip') || 
         'unknown';
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = getClientIP(req);

  try {
    const body = await req.json();
    const { formId, clientId, clientName, clientPhone, responses } = body;

    // Validate required fields
    if (!formId) {
      return new Response(
        JSON.stringify({ error: "formId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!validateUUID(formId)) {
      console.warn(`[${clientIP}] Invalid formId format: ${formId}`);
      return new Response(
        JSON.stringify({ error: "Invalid form ID format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (clientId && !validateUUID(clientId)) {
      console.warn(`[${clientIP}] Invalid clientId format: ${clientId}`);
      return new Response(
        JSON.stringify({ error: "Invalid client ID format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!responses || typeof responses !== "object") {
      return new Response(
        JSON.stringify({ error: "responses is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate optional fields
    if (clientName && !validateName(clientName)) {
      return new Response(
        JSON.stringify({ error: "Invalid name format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (clientPhone && !validatePhone(clientPhone)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize inputs
    const sanitizedName = clientName ? sanitizeString(clientName) : null;
    const sanitizedPhone = clientPhone ? sanitizeString(clientPhone) : null;
    const sanitizedResponses = sanitizeResponses(responses);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check rate limit
    const { data: canProceed } = await supabase.rpc('check_rate_limit', {
      p_identifier: clientIP,
      p_action: 'form_submit',
      p_max_requests: RATE_LIMIT_MAX_REQUESTS,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS
    });

    if (!canProceed) {
      console.warn(`[${clientIP}] Rate limit exceeded for form submission`);
      
      // Log security event
      await supabase.from('security_audit_logs').insert({
        event_type: 'rate_limit_exceeded',
        ip_address: clientIP,
        user_agent: req.headers.get('user-agent'),
        details: { action: 'form_submit', form_id: formId }
      });
      
      return new Response(
        JSON.stringify({ error: "Too many submissions. Please wait a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record the request
    await supabase.rpc('record_rate_limit_hit', {
      p_identifier: clientIP,
      p_action: 'form_submit'
    });

    console.log(`[${clientIP}] Submitting response for form ${formId}`);

    // Fetch form to get account_id, title and validate
    const { data: form, error: formError } = await supabase
      .from("forms")
      .select("id, account_id, is_active, require_client_info, title")
      .eq("id", formId)
      .eq("is_active", true)
      .maybeSingle();

    if (formError) {
      console.error(`[${clientIP}] Error fetching form:`, formError);
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
      if (!sanitizedName || !sanitizedPhone) {
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
        console.warn(`[${clientIP}] Client not found, proceeding without linking`);
        resolvedClientId = null;
      }
    }

    // Try to find existing client by phone if not provided
    if (!resolvedClientId && sanitizedPhone) {
      // Normalize phone
      let normalizedPhone = sanitizedPhone.replace(/\D/g, "");
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
        console.log(`[${clientIP}] Found existing client by phone: ${resolvedClientId}`);
      }
    }

    // Insert form response
    const { data: response, error: insertError } = await supabase
      .from("form_responses")
      .insert({
        account_id: form.account_id,
        form_id: formId,
        client_id: resolvedClientId,
        client_name: sanitizedName,
        client_phone: sanitizedPhone,
        responses: sanitizedResponses,
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error(`[${clientIP}] Error inserting response:`, insertError);
      return new Response(
        JSON.stringify({ error: "Failed to submit response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${clientIP}] Response submitted successfully: ${response.id}`);

    // Log successful submission
    await supabase.from('security_audit_logs').insert({
      event_type: 'form_submission',
      account_id: form.account_id,
      ip_address: clientIP,
      user_agent: req.headers.get('user-agent'),
      details: { 
        form_id: formId, 
        form_title: form.title,
        response_id: response.id,
        client_id: resolvedClientId 
      }
    });

    // Mark form send as responded if client linked
    if (resolvedClientId) {
      const { error: updateSendError } = await supabase
        .from("client_form_sends")
        .update({ responded_at: new Date().toISOString() })
        .eq("client_id", resolvedClientId)
        .eq("form_id", formId)
        .is("responded_at", null);

      if (updateSendError) {
        console.warn(`[${clientIP}] Could not update form send status:`, updateSendError);
      } else {
        console.log(`[${clientIP}] Marked form send as responded for client ${resolvedClientId}`);
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
        let notificationClientName = sanitizedName || "Cliente";
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
          console.warn(`[${clientIP}] Could not create notifications:`, notifyError);
        } else {
          console.log(`[${clientIP}] Created ${notifications.length} notifications for form response`);
        }
      }
    } catch (notifyErr) {
      console.warn(`[${clientIP}] Error creating notifications:`, notifyErr);
    }

    return new Response(
      JSON.stringify({ success: true, responseId: response.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[${clientIP}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});