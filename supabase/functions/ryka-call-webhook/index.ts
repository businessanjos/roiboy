// @ts-nocheck
// Webhook do Call Ryka: valida a assinatura HMAC e completa a ligação no ROY.
import { createClient } from "npm:@supabase/supabase-js@2";
import { RYKA_ENGINE, persistRykaCall, rykaFetch } from "../_shared/ryka-call.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-ryka-event, x-ryka-delivery, x-ryka-timestamp, x-ryka-signature",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const rawBody = await req.text();
    const signatureHeader = (req.headers.get("x-ryka-signature") || "").replace(/^sha256=/, "");
    const event = req.headers.get("x-ryka-event") || "";
    const delivery = req.headers.get("x-ryka-delivery") || "";

    const payload = JSON.parse(rawBody || "{}");
    const call = payload?.data?.call || payload?.data || null;

    // Descobre a conta pelo external_ref (registro criado na discagem) ou pelo call_id já gravado.
    let accountId: string | null = null;
    if (call?.external_ref) {
      const { data } = await supabase
        .from("threecplus_call_logs")
        .select("account_id")
        .eq("id", String(call.external_ref))
        .maybeSingle();
      accountId = data?.account_id ?? null;
    }
    if (!accountId && call?.id) {
      const { data } = await supabase
        .from("threecplus_call_logs")
        .select("account_id")
        .eq("engine", RYKA_ENGINE)
        .eq("call_id", String(call.id))
        .maybeSingle();
      accountId = data?.account_id ?? null;
    }
    if (!accountId) {
      const { data } = await supabase
        .from("integrations")
        .select("account_id")
        .eq("type", RYKA_ENGINE)
        .eq("status", "connected")
        .limit(2);
      if ((data || []).length === 1) accountId = data[0].account_id;
    }
    if (!accountId) return json({ received: true, ignored: "conta não identificada" });

    const { data: integration } = await supabase
      .from("integrations")
      .select("config")
      .eq("account_id", accountId)
      .eq("type", RYKA_ENGINE)
      .maybeSingle();
    const secret = integration?.config?.webhook_secret ? String(integration.config.webhook_secret) : null;
    const token = integration?.config?.api_token ? String(integration.config.api_token) : null;

    if (secret) {
      const expected = await hmacHex(secret, rawBody);
      if (!signatureHeader || !safeEqual(expected, signatureHeader.toLowerCase())) {
        console.warn("[ryka-call-webhook] assinatura inválida", { delivery, event });
        return json({ error: "Assinatura inválida" }, 401);
      }
    }

    if (!token) return json({ received: true, ignored: "token não configurado" });

    const eventName = String(payload?.event || event || "");
    if (!eventName.startsWith("call.")) return json({ received: true, ignored: eventName });

    if (eventName === "call.ended" && call?.id) {
      // Busca os dados finais completos (a versão do webhook pode ser parcial).
      const { status, body } = await rykaFetch(token, `/calls/${encodeURIComponent(String(call.id))}`);
      const full = status === 200 ? (body?.data ?? body) : call;
      const result = await persistRykaCall(supabase, accountId, { ...call, ...full }, token);
      return json({ received: true, ...result });
    }

    return json({ received: true, event: eventName });
  } catch (error) {
    console.error("[ryka-call-webhook] fatal:", error);
    return json({ error: String(error?.message || error) }, 500);
  }
});
