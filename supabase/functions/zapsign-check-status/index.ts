import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const { document_token } = await req.json();
    if (!document_token) {
      return new Response(
        JSON.stringify({ success: false, error: "document_token is required" }),
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
      status: s.status,
      signed_at: s.signed_at || null,
      token: s.token,
      sign_url: `https://app.zapsign.com.br/verificar/${s.token}`,
    }));

    const allSigned = signers.length > 0 && signers.every((s: any) => s.status === "signed");

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
