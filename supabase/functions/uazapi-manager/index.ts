import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const UAZAPI_URL = Deno.env.get("UAZAPI_URL") || "";
const UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN") || "";

async function uazapiAdmin(endpoint: string, method: string, body?: unknown) {
  const r = await fetch(`${UAZAPI_URL}${endpoint}`, { method, headers: { "Content-Type": "application/json", "admintoken": UAZAPI_ADMIN_TOKEN }, body: body ? JSON.stringify(body) : undefined });
  return r.json();
}

async function uazapiInstance(endpoint: string, method: string, token: string, body?: unknown) {
  const r = await fetch(`${UAZAPI_URL}${endpoint}`, { method, headers: { "Content-Type": "application/json", "token": token }, body: body ? JSON.stringify(body) : undefined });
  return r.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: userData } = await supabase.from("users").select("id, name, account_id, role, is_also_admin").eq("auth_user_id", user.id).single();
    if (!userData) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const payload = await req.json();
    const { action, sector_id, phone, message, group_id } = payload;
    const accountId = userData.account_id;

    // Get integration
    let q = supabase.from("integrations").select("id, config, status").eq("account_id", accountId).eq("type", "whatsapp");
    q = sector_id ? q.eq("sector_id", sector_id) : q.is("sector_id", null);
    const { data: intData } = await q.maybeSingle();
    const token = intData?.config?.instance_token;
    const instanceName = intData?.config?.instance_name || `roy-${accountId.slice(0,8)}`;

    let result: unknown = { success: true };

    if (action === "status") {
      const all = await uazapiAdmin("/instance/all", "GET") as Array<{name?:string;status?:string;owner?:string}>;
      const inst = all.find(i => i.name === instanceName);
      result = { state: inst?.status || "unknown", connected: inst?.status === "connected", owner: inst?.owner };
      if (intData?.id) await supabase.from("integrations").update({ status: inst?.status === "connected" ? "connected" : "disconnected" }).eq("id", intData.id);
    } else if (action === "create") {
      const r = await uazapiAdmin("/instance/init", "POST", { name: instanceName });
      const newToken = r.token || r.instance?.token;
      await supabase.from("integrations").upsert({ account_id: accountId, type: "whatsapp", sector_id: sector_id || null, status: "pending", config: { provider: "uazapi", instance_name: instanceName, instance_token: newToken } }, { onConflict: "account_id,type,sector_id" });
      result = { ...r, token: newToken };
    } else if (action === "connect" || action === "qrcode") {
      result = await uazapiAdmin(`/instance/connect/${instanceName}`, "GET");
    } else if (action === "disconnect") {
      if (token) try { await uazapiInstance("/logout", "POST", token); } catch {}
      if (intData?.id) await supabase.from("integrations").update({ status: "disconnected" }).eq("id", intData.id);
      result = { disconnected: true };
    } else if (action === "send_text" && token) {
      result = await uazapiInstance("/message/sendText", "POST", token, { number: phone?.replace(/\D/g,""), text: message });
    } else if (action === "send_to_group" && token) {
      const jid = group_id?.includes("@g.us") ? group_id : `${group_id}@g.us`;
      result = await uazapiInstance("/message/sendText", "POST", token, { groupJid: jid, text: message });
    } else if (action === "list_groups" && token) {
      const r = await uazapiInstance("/group/fetchAllGroups", "GET", token);
      result = { groups: (Array.isArray(r) ? r : r.groups || []).map((g:any) => ({ group_jid: g.JID||g.jid||g.id, name: g.Name||g.name||g.Subject })) };
    } else if (action === "list_instances") {
      const all = await uazapiAdmin("/instance/all", "GET") as Array<{name?:string;status?:string;owner?:string}>;
      result = { instances: all.filter(i => i.name?.startsWith(`roy-${accountId.slice(0,8)}`)) };
    } else if (action === "list_sector_instances") {
      const { data: ints } = await supabase.from("integrations").select("id, sector_id, config, status, display_name, pin_hash").eq("account_id", accountId).eq("type", "whatsapp").not("sector_id", "is", null);
      result = { instances: (ints||[]).map((i:any) => ({ id: i.id, sector_id: i.sector_id, instance_name: i.config?.instance_name, status: i.status, has_pin: !!i.pin_hash })) };
    } else if (action === "add_instance_to_sector") {
      const all = await uazapiAdmin("/instance/all", "GET") as Array<{name?:string;token?:string;status?:string;owner?:string}>;
      const inst = all.find(i => i.name === payload.instance_name);
      if (!inst) return new Response(JSON.stringify({ error: "Instance not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      await supabase.from("integrations").insert({ account_id: accountId, type: "whatsapp", sector_id, status: inst.status === "connected" ? "connected" : "disconnected", config: { provider: "uazapi", instance_name: payload.instance_name, instance_token: inst.token, owner: inst.owner } });
      result = { success: true };
    } else if (action === "verify_instance_pin") {
      const { data: int } = await supabase.from("integrations").select("pin_hash").eq("id", payload.integration_id).single();
      if (!int?.pin_hash) result = { valid: true };
      else {
        const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload.pin + accountId));
        result = { valid: Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('') === int.pin_hash };
      }
    }

    return new Response(JSON.stringify({ data: result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
