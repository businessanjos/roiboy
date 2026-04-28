import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ZAPSIGN_API_TOKEN = Deno.env.get("ZAPSIGN_API_TOKEN");
    if (!ZAPSIGN_API_TOKEN) throw new Error("ZAPSIGN_API_TOKEN is not configured");

    const { contract_pdf_base64, contract_name, signers, sandbox } = await req.json();

    if (!contract_pdf_base64 || !signers || signers.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "contract_pdf_base64 and signers are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const roleLabels: Record<string, string> = {
      contratante: "Contratante",
      contratado: "Contratado",
      representante_legal: "Representante Legal",
      testemunha: "Testemunha",
      fiador: "Fiador",
    };

    const zapSignPayload: any = {
      sandbox: sandbox !== false,
      name: contract_name || "Contrato de Prestação de Serviços",
      base64_pdf: contract_pdf_base64,
      lang: "pt-br",
      signers: signers.map((s: any) => {
        const roleLabel = roleLabels[s.role] || s.role || "";
        return {
          name: roleLabel ? `${s.name} (${roleLabel})` : s.name,
          email: s.email || undefined,
          phone_country: s.phone ? "55" : undefined,
          phone_number: s.phone || undefined,
          auth_mode: "assinaturaTela",
          send_automatic_email: !!s.email,
          send_automatic_whatsapp: !!s.phone,
        };
      }),
    };

    const response = await fetch(
      `https://api.zapsign.com.br/api/v1/docs/?api_token=${ZAPSIGN_API_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(zapSignPayload),
      },
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

    const signerLinks = (data.signers || []).map((s: any) => ({
      name: s.name,
      sign_url: `https://app.zapsign.com.br/verificar/${s.token}`,
      token: s.token,
      status: s.status,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        document_token: data.token,
        document_name: data.name,
        document_status: data.status,
        signers: signerLinks,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("zapsign-send error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
