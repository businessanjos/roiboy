import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { AiBlockedError, brtDayKey, summarizeClientDay } from "../_shared/clientDailySummary.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u, error: uErr } = await userClient.auth.getUser();
    if (uErr || !u?.user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const clientId = String(body?.client_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(clientId)) return json({ error: "client_id inválido" }, 400);

    // Respeita RLS: só segue se o usuário consegue ver o cliente.
    const { data: visible } = await userClient.from("clients").select("id").eq("id", clientId).maybeSingle();
    if (!visible) return json({ error: "Cliente não encontrado" }, 404);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "IA não configurada" }, 500);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const r = await summarizeClientDay(admin, apiKey, clientId, brtDayKey(new Date()));
    return json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof AiBlockedError) {
      const msg = e.status === 402 ? "Créditos de IA esgotados." : e.status === 429 ? "Muitas solicitações, tente em instantes." : "IA bloqueada para o workspace.";
      return json({ error: msg }, e.status);
    }
    console.error("[client-daily-summary-now]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
