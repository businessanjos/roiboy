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
    } else if (value !== null && typeof value === 'object') {
      // Preserve object values (e.g. address, employee data, location)
      sanitized[sanitizedKey] = value;
    }
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
      .select("id, account_id, is_active, require_client_info, title, fields")
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

    // Helper function to normalize phone numbers
    function normalizePhoneNumber(phone: string): string {
      let normalized = phone.replace(/\D/g, "");
      if (!normalized.startsWith("+")) {
        if (normalized.length === 11 || normalized.length === 10) {
          normalized = "+55" + normalized;
        } else {
          normalized = "+" + normalized;
        }
      }
      return normalized;
    }

    let resolvedClientId = clientId;

    // If clientId provided, verify it exists AND validate phone matches
    if (clientId) {
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id, phone_e164")
        .eq("id", clientId)
        .eq("account_id", form.account_id)
        .maybeSingle();

      if (clientError || !clientData) {
        console.warn(`[${clientIP}] Client not found, proceeding without linking`);
        resolvedClientId = null;
      } else if (sanitizedPhone && clientData.phone_e164) {
        // CRITICAL: Validate that the phone submitted matches the URL client's phone
        const normalizedInputPhone = normalizePhoneNumber(sanitizedPhone);
        const urlClientPhone = clientData.phone_e164;
        
        if (normalizedInputPhone !== urlClientPhone) {
          console.warn(`[${clientIP}] Phone mismatch! URL client has ${urlClientPhone}, form submitted ${normalizedInputPhone}. Will search by phone instead.`);
          // Reset clientId - the person filling is NOT the one in the URL
          resolvedClientId = null;
        } else {
          console.log(`[${clientIP}] Phone validated - matches URL client ${clientId}`);
        }
      }
    }

    // Try to find existing client by phone if not resolved yet
    if (!resolvedClientId && sanitizedPhone) {
      const normalizedPhone = normalizePhoneNumber(sanitizedPhone);
      const phoneDigits = normalizedPhone.replace(/\D/g, '');
      const lastDigits = phoneDigits.slice(-8);

      console.log(`[${clientIP}] Searching client by phone: normalized=${normalizedPhone}, lastDigits=${lastDigits}`);

      // 1. Exact match on phone_e164 — try both with and without "+" prefix
      const phoneNoPlus = normalizedPhone.replace(/^\+/, '');
      const { data: exactClient } = await supabase
        .from("clients")
        .select("id")
        .eq("account_id", form.account_id)
        .in("phone_e164", [normalizedPhone, phoneNoPlus])
        .maybeSingle();

      if (exactClient) {
        resolvedClientId = exactClient.id;
        console.log(`[${clientIP}] Found client by exact phone match: ${resolvedClientId}`);
      } else {
        // 2. Fuzzy match: search clients whose phone ends with same 8 digits.
        // Use range() to bypass the 1000-row PostgREST default limit, paging through all clients.
        const PAGE = 1000;
        let from = 0;
        let matchedClient: { id: string } | null = null;

        while (!matchedClient) {
          const { data: page, error: pageError } = await supabase
            .from("clients")
            .select("id, phone_e164, additional_phones")
            .eq("account_id", form.account_id)
            .range(from, from + PAGE - 1);

          if (pageError || !page || page.length === 0) break;

          matchedClient = page.find(c => {
            if (c.phone_e164) {
              const cDigits = c.phone_e164.replace(/\D/g, '');
              if (cDigits.slice(-8) === lastDigits) return true;
            }
            if (c.additional_phones && Array.isArray(c.additional_phones)) {
              return (c.additional_phones as string[]).some((p: string) => {
                const pDigits = String(p).replace(/\D/g, '');
                return pDigits.slice(-8) === lastDigits;
              });
            }
            return false;
          }) || null;

          if (page.length < PAGE) break;
          from += PAGE;
        }

        if (matchedClient) {
          resolvedClientId = matchedClient.id;
          console.log(`[${clientIP}] Found client by fuzzy phone match (last 8 digits): ${resolvedClientId}`);
        } else {
          console.log(`[${clientIP}] No client found for phone ${normalizedPhone} (last8=${lastDigits}), response will be unlinked`);
        }
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

    // Save responses to custom field values if client is linked and form has fields
    if (resolvedClientId && form.fields && Array.isArray(form.fields) && form.fields.length > 0) {
      try {
        const { data: fieldDefs } = await supabase
          .from("custom_fields")
          .select("id, field_type")
          .in("id", form.fields)
          .eq("is_active", true);

        if (fieldDefs && fieldDefs.length > 0) {
          const upserts = [];
          for (const fieldDef of fieldDefs) {
            const value = sanitizedResponses[fieldDef.id];
            if (value === undefined || value === null || value === "") continue;

            const row: Record<string, unknown> = {
              account_id: form.account_id,
              client_id: resolvedClientId,
              field_id: fieldDef.id,
            };

            switch (fieldDef.field_type) {
              case "boolean":
                row.value_boolean = Boolean(value);
                break;
              case "number":
              case "currency":
              case "rating":
                row.value_number = Number(value) || null;
                break;
              case "date":
                row.value_date = value;
                break;
              case "multi_select":
              case "user":
              case "multi_instagram":
              case "location":
                // Handle both array values and string values (from custom renderers)
                if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
                  row.value_json = value;
                } else if (typeof value === 'string' && value.trim()) {
                  row.value_text = value;
                }
                break;
              default:
                row.value_text = String(value);
            }

            upserts.push(row);
          }

          if (upserts.length > 0) {
            const { error: upsertError } = await supabase
              .from("client_field_values")
              .upsert(upserts, { onConflict: "client_id,field_id" });

            if (upsertError) {
              console.warn(`[${clientIP}] Error saving field values:`, upsertError);
            } else {
              console.log(`[${clientIP}] Saved ${upserts.length} field values for client ${resolvedClientId}`);
            }
          }
        }
      } catch (fieldErr) {
        console.warn(`[${clientIP}] Error processing field values:`, fieldErr);
      }
    }

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
    let notificationClientName = sanitizedName || "Cliente";
    try {
      // Get all users in the account
      const { data: accountUsers, error: usersError } = await supabase
        .from("users")
        .select("id")
        .eq("account_id", form.account_id);

      if (!usersError && accountUsers && accountUsers.length > 0) {
        // Get client name for notification
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

    // Trigger AI analysis if client is linked
    if (resolvedClientId) {
      try {
        // Convert form responses to readable text for AI analysis
        const responseText = Object.entries(sanitizedResponses)
          .map(([question, answer]) => {
            if (Array.isArray(answer)) {
              return `${question}: ${answer.join(", ")}`;
            }
            return `${question}: ${answer}`;
          })
          .join("\n");

        const formContext = `[Resposta ao formulário "${form.title}"]\n${responseText}`;
        
        console.log(`[${clientIP}] Triggering AI analysis for form response from client ${resolvedClientId}`);

        // Call analyze-message edge function
        const analyzeResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-message`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              content_text: formContext,
              client_id: resolvedClientId,
              account_id: form.account_id,
              source: "form_response",
            }),
          }
        );

        if (analyzeResponse.ok) {
          const analysisResult = await analyzeResponse.json();
          console.log(`[${clientIP}] AI analysis completed:`, {
            roi_events: analysisResult.results?.roi_events || 0,
            risk_events: analysisResult.results?.risk_events || 0,
            life_events: analysisResult.results?.life_events || 0,
          });
        } else {
          console.warn(`[${clientIP}] AI analysis failed:`, analyzeResponse.status);
        }
      } catch (aiErr) {
        console.warn(`[${clientIP}] Error triggering AI analysis:`, aiErr);
        // Don't fail the response if AI analysis fails
      }
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