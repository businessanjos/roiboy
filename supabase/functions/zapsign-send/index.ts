import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function onlyDigits(v?: string | null) {
  return (v || "").replace(/\D+/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ZAPSIGN_API_TOKEN = Deno.env.get("ZAPSIGN_API_TOKEN");
    if (!ZAPSIGN_API_TOKEN) {
      return json({ success: false, error: "ZAPSIGN_API_TOKEN não configurado" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const { contract_id, sandbox } = body || {};

    // Back-compat path: payload already prepared
    let { contract_pdf_base64, contract_name, signers } = body || {};
    const explicitSigners = Array.isArray(signers) && signers.length > 0 ? signers : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Preferred path: contract_id -> assemble payload server-side
    if (contract_id) {
      const { data: contract, error: cErr } = await supabase
        .from("digital_contracts")
        .select("*")
        .eq("id", contract_id)
        .maybeSingle();

      if (cErr || !contract) {
        return json({ success: false, error: "Contrato não encontrado" }, 404);
      }

      if (!contract.signed_pdf_path) {
        return json(
          { success: false, error: "Gere o PDF do contrato antes de enviar para assinatura." },
          400,
        );
      }

      // Download PDF and convert to base64
      const { data: file, error: dlErr } = await supabase.storage
        .from("digital-contracts")
        .download(contract.signed_pdf_path);
      if (dlErr || !file) {
        return json(
          { success: false, error: `Falha ao baixar PDF: ${dlErr?.message || "arquivo ausente"}` },
          500,
        );
      }
      const buf = new Uint8Array(await file.arrayBuffer());
      // base64 encode in chunks to avoid stack overflow
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)) as any);
      }
      contract_pdf_base64 = btoa(binary);
      contract_name = contract_name || `Contrato ${contract.contract_number || contract.id}`;

      if (explicitSigners) {
        // Caller chose signers explicitly; use them as-is (after light normalization)
        signers = explicitSigners
          .map((s: any) => ({
            role: s.role || "contratante",
            name: (s.name || "").trim(),
            email: s.email ? String(s.email).trim() : undefined,
            phone: onlyDigits(s.phone) || undefined,
          }))
          .filter((s: any) => s.name && (s.email || s.phone));
        if (signers.length === 0) {
          return json(
            { success: false, error: "Selecione ao menos um signatário com e-mail ou telefone." },
            400,
          );
        }
      } else {
        // Build signers from contract row
        const built: any[] = [];

        // Client (or representative)
        const clientPhone = onlyDigits((contract as any).client_phone);
        if (contract.client_representative) {
          built.push({
            role: "representante_legal",
            name: contract.client_representative,
            email: contract.client_email || undefined,
            phone: clientPhone || undefined,
          });
        } else if (contract.client_name) {
          built.push({
            role: "contratante",
            name: contract.client_name,
            email: contract.client_email || undefined,
            phone: clientPhone || undefined,
          });
        }

        // Company side
        if (contract.company_representative) {
          built.push({
            role: "contratado",
            name: contract.company_representative,
            email: contract.company_email || undefined,
          });
        }

        // Pull additional phone from clients table if missing
        if (built[0] && !built[0].phone && contract.client_id) {
          const { data: clientRow } = await supabase
            .from("clients")
            .select("phone")
            .eq("id", contract.client_id)
            .maybeSingle();
          const p = onlyDigits(clientRow?.phone);
          if (p) built[0].phone = p;
        }

        signers = built.filter((s) => s.name && (s.email || s.phone));
        if (signers.length === 0) {
          return json(
            {
              success: false,
              error: "Nenhum signatário com e-mail ou telefone disponível no contrato.",
            },
            400,
          );
        }
      }
    }

    if (!contract_pdf_base64 || !signers || signers.length === 0) {
      return json(
        { success: false, error: "contract_pdf_base64 e signers são obrigatórios" },
        400,
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
        const phone = onlyDigits(s.phone);
        return {
          name: roleLabel ? `${s.name} (${roleLabel})` : s.name,
          email: s.email || undefined,
          phone_country: phone ? "55" : undefined,
          phone_number: phone || undefined,
          auth_mode: "assinaturaTela",
          send_automatic_email: !!s.email,
          send_automatic_whatsapp: !!phone,
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
      return json(
        { success: false, error: `ZapSign error [${response.status}]: ${responseText.substring(0, 500)}` },
        500,
      );
    }

    if (!response.ok) {
      return json(
        { success: false, error: `ZapSign API error [${response.status}]: ${JSON.stringify(data)}` },
        500,
      );
    }

    const signerLinks = (data.signers || []).map((s: any) => ({
      name: s.name,
      sign_url: `https://app.zapsign.com.br/verificar/${s.token}`,
      token: s.token,
      status: s.status,
    }));

    // Persist token + status on contract
    if (contract_id && data.token) {
      await supabase
        .from("digital_contracts")
        .update({
          zapsign_document_token: data.token,
          status: "sent",
        })
        .eq("id", contract_id);
    }

    return json({
      success: true,
      document_token: data.token,
      document_name: data.name,
      document_status: data.status,
      signers: signerLinks,
    });
  } catch (error: unknown) {
    console.error("zapsign-send error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return json({ success: false, error: errorMessage }, 500);
  }
});
