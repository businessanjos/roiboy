import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Content-Type": "application/json",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function error(msg: string, status = 400) {
  return json({ error: msg }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("INTEGRATION_API_KEY");
  if (!expectedKey || !apiKey || apiKey !== expectedKey) {
    return error("Unauthorized", 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // Resolve body once (for non-GET) so account_id and other params can come from either source.
  let body: any = {};
  if (req.method === "POST" || req.method === "PUT") {
    body = await req.json().catch(() => ({}));
  }

  // ── Tenant scoping: caller MUST specify which account they are acting on.
  // This prevents the service-role key from returning data from every tenant.
  const accountId = url.searchParams.get("account_id") || body?.account_id;
  if (!accountId || typeof accountId !== "string" || !UUID_RE.test(accountId)) {
    return error("account_id is required (uuid)", 400);
  }

  try {
    // ── list_clients ──
    if (action === "list_clients") {
      const { data, error: e } = await supabase
        .from("clients")
        .select("id, full_name, cnpj, emails, phone_e164, status, created_at, account_id")
        .eq("account_id", accountId)
        .order("full_name");

      if (e) return error(e.message, 500);

      const mapped = (data ?? []).map((c: any) => ({
        id: c.id,
        name: c.full_name,
        document: c.cnpj,
        email: Array.isArray(c.emails) ? c.emails[0] : c.emails,
        phone: c.phone_e164,
        status: c.status,
        created_at: c.created_at,
      }));

      return json({ clients: mapped });
    }

    // ── get_client ──
    if (action === "get_client") {
      const clientId = url.searchParams.get("client_id") || body?.client_id;
      if (!clientId || typeof clientId !== "string" || !UUID_RE.test(clientId)) {
        return error("client_id is required (uuid)");
      }

      const { data: client, error: e1 } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .eq("account_id", accountId)
        .maybeSingle();

      if (e1) return error(e1.message, 500);
      if (!client) return error("Client not found", 404);

      const { data: contracts } = await supabase
        .from("client_contracts")
        .select("id, contract_type, value, status, start_date, end_date, payment_method, notes")
        .eq("client_id", clientId)
        .eq("account_id", accountId)
        .eq("status", "active");

      return json({ client, active_contracts: contracts ?? [] });
    }

    // ── list_contracts ──
    if (action === "list_contracts") {
      const clientId = url.searchParams.get("client_id") || body?.client_id;
      if (!clientId || typeof clientId !== "string" || !UUID_RE.test(clientId)) {
        return error("client_id is required (uuid)");
      }

      // Verify the client belongs to the requesting account before exposing its contracts.
      const { data: ownerCheck } = await supabase
        .from("clients")
        .select("id")
        .eq("id", clientId)
        .eq("account_id", accountId)
        .maybeSingle();
      if (!ownerCheck) return error("Client not found", 404);

      const { data, error: e } = await supabase
        .from("client_contracts")
        .select("id, contract_type, value, status, start_date, end_date, payment_method, notes")
        .eq("client_id", clientId)
        .eq("account_id", accountId)
        .order("start_date", { ascending: false });

      if (e) return error(e.message, 500);

      const mapped = (data ?? []).map((c: any) => ({
        id: c.id,
        plan_name: c.contract_type,
        amount: c.value,
        status: c.status,
        start_date: c.start_date,
        end_date: c.end_date,
      }));

      return json({ contracts: mapped });
    }

    // ── update_client ──
    if (action === "update_client") {
      const clientId = url.searchParams.get("client_id") || body?.client_id;
      if (!clientId || typeof clientId !== "string" || !UUID_RE.test(clientId)) {
        return error("client_id is required (uuid)");
      }

      const allowedFields: Record<string, string> = {
        phone: "phone_e164",
        email: "emails",
        name: "full_name",
        status: "status",
      };

      const updates: Record<string, unknown> = {};
      for (const [input, col] of Object.entries(allowedFields)) {
        if (body[input] !== undefined) {
          if (typeof body[input] !== "string" || body[input].length > 500) {
            return error(`Invalid value for ${input}`);
          }
          if (col === "emails") {
            updates[col] = [body[input]];
          } else {
            updates[col] = body[input];
          }
        }
      }

      if (Object.keys(updates).length === 0) {
        return error("No valid fields to update");
      }

      const { data, error: e } = await supabase
        .from("clients")
        .update(updates)
        .eq("id", clientId)
        .eq("account_id", accountId)
        .select("id, full_name, phone_e164, emails, status")
        .maybeSingle();

      if (e) return error(e.message, 500);
      if (!data) return error("Client not found", 404);

      return json({ success: true, client: data });
    }

    return error("Invalid action. Use: list_clients, get_client, list_contracts, update_client");
  } catch (_err) {
    return error("Internal server error", 500);
  }
});
