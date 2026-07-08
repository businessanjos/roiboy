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
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const auth = await authenticateRequestWithLegacy(req, supabase);
    if (!auth.authenticated || !auth.accountId) {
      return unauthorizedResponse(auth.error || "Unauthorized", corsHeaders);
    }
    const accountId = auth.accountId;

    const { data, error } = await supabase
      .from("pipelines")
      .select("id, name, is_default, stages:deal_stages(id, name, display_order)")
      .eq("account_id", accountId)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      console.error("[list-pipelines] DB error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to load pipelines", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const pipelines = (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      is_default: !!p.is_default,
      stages: (p.stages || [])
        .slice()
        .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((s: any) => ({
          id: s.id,
          name: s.name,
          display_order: s.display_order ?? 0,
        })),
    }));

    if (auth.method === "api_key" && auth.apiKeyId) {
      await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
    }

    return new Response(
      JSON.stringify({ pipelines }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[list-pipelines] Unhandled:", e);
    return new Response(
      JSON.stringify({ error: "Internal error", details: e?.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
