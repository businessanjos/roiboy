// Webhook do Notazz — recebe atualização de status de NFS-e
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body: any = await req.json().catch(() => ({}));
    const externalId = body?.externalId || body?.invoice?.externalId;
    const providerId = body?.invoice?.id || body?.id;

    let issuanceId: string | null = externalId ?? null;

    if (!issuanceId && providerId) {
      const { data } = await supabase
        .from("nfse_issuances")
        .select("id")
        .eq("provider_request_id", providerId)
        .maybeSingle();
      issuanceId = data?.id ?? null;
    }

    if (!issuanceId) {
      return new Response(JSON.stringify({ ok: false, error: "issuance não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = (body?.invoice?.status || body?.status || "").toLowerCase();
    const update: Record<string, any> = {
      provider_response: body,
    };

    if (status === "issued" || status === "emitido" || status === "success") {
      update.status = "issued";
      update.issued_at = new Date().toISOString();
      update.nfse_number = body?.invoice?.number ?? update.nfse_number;
      update.verification_code = body?.invoice?.verificationCode ?? null;
      update.pdf_url = body?.invoice?.pdfUrl ?? null;
      update.xml_url = body?.invoice?.xmlUrl ?? null;
      update.rps_number = body?.invoice?.rps?.number ?? null;
      update.rps_series = body?.invoice?.rps?.series ?? null;
    } else if (status === "rejected" || status === "error" || status === "rejeitado") {
      update.status = "rejected";
      update.rejected_reason = body?.invoice?.errorMessage || body?.message || "Rejeitada pelo provedor";
    } else if (status === "cancelled" || status === "cancelado") {
      update.status = "cancelled";
      update.cancelled_at = new Date().toISOString();
      update.cancelled_reason = body?.invoice?.cancellationReason || body?.reason || null;
    } else {
      update.status = "processing";
    }

    await supabase.from("nfse_issuances").update(update).eq("id", issuanceId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("nfse-webhook error:", err);
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
