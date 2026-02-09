import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateRequestWithLegacy,
  unauthorizedResponse,
  logApiKeyUsage,
} from "../_shared/api-key-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface CreateLeadPayload {
  full_name: string;
  phone?: string;
  email?: string;
  instagram?: string;
  source?: string;
  revenue_range?: string;
  tags?: string[];
  notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const auth = await authenticateRequestWithLegacy(req, supabase);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: CreateLeadPayload = await req.json();

    if (!payload.full_name || !payload.full_name.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing required field: full_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountId = auth.accountId!;

    // Check duplicate by phone
    if (payload.phone && payload.phone.trim()) {
      const { data: existing } = await supabase
        .from("leads")
        .select("id, full_name")
        .eq("phone", payload.phone.trim())
        .eq("account_id", accountId)
        .maybeSingle();

      if (existing) {
        if (auth.method === "api_key" && auth.apiKeyId) {
          await logApiKeyUsage(supabase, auth.apiKeyId, req, 409);
        }
        return new Response(
          JSON.stringify({ error: "Lead already exists", existing_lead: existing }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Build tags array filtering empty strings
    const tags = (payload.tags || []).filter((t) => t && t.trim());

    const { data: newLead, error: insertError } = await supabase
      .from("leads")
      .insert({
        account_id: accountId,
        full_name: payload.full_name.trim(),
        phone: payload.phone?.trim() || null,
        email: payload.email?.trim() || null,
        instagram: payload.instagram?.trim() || null,
        source: payload.source?.trim() || null,
        revenue_range: payload.revenue_range?.trim() || null,
        tags: tags.length > 0 ? tags : [],
        notes: payload.notes?.trim() || null,
        status: "new",
      })
      .select("id, full_name, phone, status")
      .single();

    if (insertError) {
      console.error("Error creating lead:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create lead", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (auth.method === "api_key" && auth.apiKeyId) {
      await logApiKeyUsage(supabase, auth.apiKeyId, req, 201);
    }

    return new Response(JSON.stringify({ success: true, lead: newLead }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in create-lead:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
