import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateRequestWithLegacy,
  unauthorizedResponse,
  logApiKeyUsage,
} from "../_shared/api-key-auth.ts";
import { createLeadCore, type CreateLeadCorePayload } from "../_shared/create-lead-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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

    const payload = (await req.json()) as CreateLeadCorePayload;
    const accountId = auth.accountId!;

    const result = await createLeadCore(supabase, accountId, payload, {
      duplicateAudit: {
        auth_method: auth.method ?? null,
        api_key_id: auth.apiKeyId ?? null,
        ip_address:
          req.headers.get("x-forwarded-for") ??
          req.headers.get("cf-connecting-ip") ??
          null,
        user_agent: req.headers.get("user-agent") ?? null,
      },
    });

    if (result.status === "error") {
      const isMissing = result.error.startsWith("Missing required field");
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: isMissing ? 400 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (result.status === "duplicate") {
      if (auth.method === "api_key" && auth.apiKeyId) {
        await logApiKeyUsage(supabase, auth.apiKeyId, req, 409);
      }
      return new Response(
        JSON.stringify({ error: "Lead already exists", existing_lead: result.existing_lead }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (auth.method === "api_key" && auth.apiKeyId) {
      await logApiKeyUsage(supabase, auth.apiKeyId, req, 201);
    }

    return new Response(
      JSON.stringify({ success: true, lead: result.lead, deal: result.deal }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in create-lead:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
