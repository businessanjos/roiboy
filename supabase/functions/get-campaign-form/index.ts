// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    if (!slug) {
      return new Response(JSON.stringify({ error: "slug is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: form, error: fErr } = await supabase
      .from("forms")
      .select("id, account_id, title, description, fields, is_active, is_campaign, campaign_meta, appearance")
      .eq("slug", slug)
      .eq("is_active", true)
      .eq("is_campaign", true)
      .maybeSingle();

    if (fErr || !form) {
      return new Response(JSON.stringify({ error: "Formulário não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fieldIds: string[] = Array.isArray(form.fields) ? form.fields : [];
    let orderedFields: any[] = [];
    if (fieldIds.length > 0) {
      const { data: cfs } = await supabase
        .from("custom_fields")
        .select("id, name, field_type, options, is_required")
        .eq("account_id", form.account_id)
        .eq("is_active", true)
        .in("id", fieldIds);

      const map = new Map((cfs || []).map((f: any) => [f.id, f]));
      orderedFields = fieldIds.map((id) => map.get(id)).filter(Boolean);
    }

    return new Response(JSON.stringify({
      form: {
        id: form.id,
        account_id: form.account_id,
        title: form.title,
        description: form.description,
        campaign_meta: form.campaign_meta || {},
        appearance: form.appearance || {},
      },
      fields: orderedFields,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("get-campaign-form error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
