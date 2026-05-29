import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ZAPSIGN_API_TOKEN = Deno.env.get("ZAPSIGN_API_TOKEN");
    if (!ZAPSIGN_API_TOKEN) throw new Error("ZAPSIGN_API_TOKEN is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json().catch(() => ({}));
    let { document_token, contract_id } = body as { document_token?: string; contract_id?: string };

    // Aceita contract_id e resolve o token internamente
    if (!document_token && contract_id) {
      const { data: c } = await supabase
        .from("digital_contracts")
        .select("zapsign_document_token")
        .eq("id", contract_id)
        .maybeSingle();
      document_token = c?.zapsign_document_token ?? undefined;
    }

    if (!document_token) {
      return new Response(
        JSON.stringify({ success: false, error: "document_token ou contract_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const response = await fetch(
      `https://api.zapsign.com.br/api/v1/docs/${document_token}/?api_token=${ZAPSIGN_API_TOKEN}`,
      { method: "GET", headers: { "Content-Type": "application/json" } },
    );

    const responseText = await response.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: `ZapSign error [${response.status}]: ${responseText.substring(0, 500)}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `ZapSign API error [${response.status}]: ${JSON.stringify(data)}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const signers = (data.signers || []).map((s: any) => ({
      name: s.name,
      email: s.email ?? null,
      phone_number: s.phone_number ?? null,
      status: s.status, // new | link-opened | signed | refused
      signed_at: s.signed_at || null,
      times_viewed: s.times_viewed ?? 0,
      last_view_at: s.last_view_at || null,
      token: s.token,
      sign_url: `https://app.zapsign.com.br/verificar/${s.token}`,
    }));

    const allSigned = signers.length > 0 && signers.every((s: any) => s.status === "signed");

    // Persiste no contrato se localizado por token
    if (contract_id || document_token) {
      const updates: Record<string, unknown> = {
        zapsign_signers: signers,
        updated_at: new Date().toISOString(),
      };
      if (allSigned) {
        updates.status = "signed";
        if (data.signed_at) updates.signed_at = data.signed_at;
        if (data.signed_file) updates.signed_file_url = data.signed_file;
      } else if (data.status) {
        // Mantém status atual se já assinado; senão reflete o status do doc
        const { data: cur } = await supabase
          .from("digital_contracts")
          .select("status")
          .eq("zapsign_document_token", document_token)
          .maybeSingle();
        if (cur && cur.status !== "signed") {
          updates.status = String(data.status).toLowerCase();
        }
      }
      await supabase
        .from("digital_contracts")
        .update(updates)
        .eq("zapsign_document_token", document_token);
    }

    return new Response(
      JSON.stringify({
        success: true,
        document_status: data.status,
        document_name: data.name,
        all_signed: allSigned,
        signed_at: data.signed_at || null,
        signed_file: data.signed_file || null,
        signers,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("zapsign-check-status error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
