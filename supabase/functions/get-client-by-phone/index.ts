import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateRequestWithLegacy,
  unauthorizedResponse,
  logApiKeyUsage,
} from "../_shared/api-key-auth.ts";
import { canonicalE164, phoneVariants as buildPhoneVariants } from "../_shared/phone-normalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Security constants
const MAX_PHONE_LENGTH = 16;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const searchType = url.searchParams.get("type");
    const rawPhone = url.searchParams.get("phone_e164");

    if (!rawPhone) {
      return new Response(
        JSON.stringify({ error: "Missing phone parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Canonical E.164 (corrige 9º dígito BR e adiciona +55 quando faltar)
    const phone = canonicalE164(rawPhone);
    if (!phone || phone.length > 20 || !phone.match(/^\+[1-9]\d{7,}$/)) {
      return new Response(JSON.stringify({ error: "Invalid phone format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate ALL plausible variants (com/sem +, com/sem 9º dígito, com/sem DDI)
    const phoneVariants = buildPhoneVariants(rawPhone);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate with support for legacy x-api-key
    const auth = await authenticateRequestWithLegacy(req, supabase);
    if (!auth.authenticated) {
      console.log("Authentication failed:", auth.error);
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    console.log(
      `get-client-by-phone: auth_method=${auth.method}, phone=${phone}, variants=${phoneVariants.join(",")}`
    );

    let client = null;

    // Only search clients table if not filtering by lead
    if (searchType !== 'lead') {
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id, full_name, phone_e164, status, tags")
        .in("phone_e164", phoneVariants)
        .eq("account_id", auth.accountId)
        .maybeSingle();

      if (clientError) {
        console.error("Database error:", clientError.code);
        if (auth.method === "api_key" && auth.apiKeyId) {
          await logApiKeyUsage(supabase, auth.apiKeyId, req, 500);
        }
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      client = clientData;
    }

    if (!client) {
      // Buscar na tabela leads por phone principal
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("id, full_name, phone, status, tags, email, instagram, source")
        .in("phone", phoneVariants)
        .eq("account_id", auth.accountId)
        .maybeSingle();

      if (leadError) {
        console.error("Lead search error:", leadError.code);
      }

      // Se não encontrou por phone principal, buscar em additional_phones com todas as variantes
      let foundLead = lead;
      if (!foundLead) {
        for (const variant of phoneVariants) {
          // Tentar formato objeto { number: variant }
          const { data: leadByAdditional } = await supabase
            .from("leads")
            .select("id, full_name, phone, status, tags, email, instagram, source")
            .eq("account_id", auth.accountId)
            .contains("additional_phones", JSON.stringify([{ number: variant }]));

          if (leadByAdditional && leadByAdditional.length > 0) {
            foundLead = leadByAdditional[0];
            break;
          }

          // Tentar formato legado (array de strings)
          const { data: leadByLegacy } = await supabase
            .from("leads")
            .select("id, full_name, phone, status, tags, email, instagram, source")
            .eq("account_id", auth.accountId)
            .contains("additional_phones", JSON.stringify([variant]));

          if (leadByLegacy && leadByLegacy.length > 0) {
            foundLead = leadByLegacy[0];
            break;
          }
        }
      }

      if (foundLead) {
        if (auth.method === "api_key" && auth.apiKeyId) {
          await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
        }
        return new Response(
          JSON.stringify({
            found: true,
            type: "lead",
            lead: {
              id: foundLead.id,
              full_name: foundLead.full_name,
              phone: foundLead.phone,
              status: foundLead.status,
              tags: foundLead.tags,
              email: foundLead.email,
              instagram: foundLead.instagram,
              source: foundLead.source,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Nenhum encontrado
      if (auth.method === "api_key" && auth.apiKeyId) {
        await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
      }
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get latest scores
    const { data: scoreData } = await supabase
      .from("score_snapshots")
      .select("roizometer, escore, quadrant, trend, computed_at")
      .eq("client_id", client.id)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get latest risk events
    const { data: riskEvents } = await supabase
      .from("risk_events")
      .select("reason, risk_level, happened_at")
      .eq("client_id", client.id)
      .order("happened_at", { ascending: false })
      .limit(3);

    // Get recent timeline (limited fields)
    const { data: recentEvents } = await supabase
      .from("message_events")
      .select("id, source, direction, sent_at, is_group, group_name")
      .eq("client_id", client.id)
      .order("sent_at", { ascending: false })
      .limit(15);

    // Get open recommendations
    const { data: recommendations } = await supabase
      .from("recommendations")
      .select("title, action_text, priority")
      .eq("client_id", client.id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(3);

    // Log API key usage
    if (auth.method === "api_key" && auth.apiKeyId) {
      await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
    }

    return new Response(
      JSON.stringify({
        found: true,
        type: "client",
        client: {
          id: client.id,
          full_name: client.full_name,
          phone_e164: client.phone_e164,
          status: client.status,
          tags: client.tags,
        },
        scores: scoreData || {
          roizometer: 0,
          escore: 0,
          quadrant: "lowE_lowROI",
          trend: "flat",
        },
        risk_events: riskEvents || [],
        recent_events: (recentEvents || []).map((e) => ({
          id: e.id,
          type: e.source,
          direction: e.direction,
          timestamp: e.sent_at,
          is_group: e.is_group || false,
          group_name: e.group_name || null,
        })),
        recommendations: recommendations || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Request processing error");
    return new Response(JSON.stringify({ error: "Request failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
