// ZapSign webhook receiver — updates digital_contracts when signature events occur.
// Public endpoint (verify_jwt = false). Optionally validates a shared secret via ?secret= query param or X-Webhook-Secret header.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const WEBHOOK_SECRET = Deno.env.get("ZAPSIGN_WEBHOOK_SECRET");

    if (!WEBHOOK_SECRET) {
      console.error("ZAPSIGN_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const url = new URL(req.url);
    const provided = url.searchParams.get("secret") || req.headers.get("x-webhook-secret");
    if (provided !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Invalid secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    console.log("zapsign-webhook payload:", JSON.stringify(payload).slice(0, 1000));

    // ZapSign sends event_type + doc info. Token can come as `token`, `open_id`, or nested under `doc`.
    const event = payload.event_type || payload.event || "unknown";
    const token =
      payload.token ||
      payload.doc?.token ||
      payload.document?.token ||
      payload.open_id ||
      null;

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing document token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: contract, error: findErr } = await supabase
      .from("digital_contracts")
      .select("id, status")
      .eq("zapsign_document_token", token)
      .maybeSingle();

    if (findErr) throw findErr;
    if (!contract) {
      console.warn("Contract not found for token", token);
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine new status
    const docStatus: string = (payload.status || payload.doc?.status || "").toLowerCase();
    const signedFile: string | null = payload.signed_file || payload.doc?.signed_file || null;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    const ev = String(event).toLowerCase();
    if (ev.includes("signed") || docStatus === "signed" || ev === "doc_signed") {
      updates.status = "signed";
      updates.signed_at = new Date().toISOString();
      if (signedFile) updates.signed_file_url = signedFile;
    } else if (ev.includes("refused") || ev.includes("rejected") || docStatus === "refused") {
      updates.status = "refused";
    } else if (ev.includes("expired") || docStatus === "expired") {
      updates.status = "expired";
    } else if (ev.includes("deleted")) {
      updates.status = "cancelled";
    } else if (ev.includes("created") || ev.includes("sent") || docStatus === "pending") {
      if (contract.status === "draft") updates.status = "sent";
    } else if (docStatus) {
      updates.status = docStatus;
    }

    // Track individual signer events
    if (payload.signer || payload.signers) {
      updates.zapsign_signers = payload.signers || [payload.signer];
    }

    const { error: updErr } = await supabase
      .from("digital_contracts")
      .update(updates)
      .eq("id", contract.id);

    if (updErr) throw updErr;

    return new Response(JSON.stringify({ ok: true, contract_id: contract.id, applied: updates }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("zapsign-webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
