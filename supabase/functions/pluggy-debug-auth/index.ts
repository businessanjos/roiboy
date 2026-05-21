const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const clientId = Deno.env.get("PLUGGY_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET") ?? "";
  const out: any = {
    has_client_id: !!clientId,
    has_client_secret: !!clientSecret,
    client_id_prefix: clientId.slice(0, 6),
    client_id_len: clientId.length,
    secret_len: clientSecret.length,
  };
  try {
    const r = await fetch("https://api.pluggy.ai/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    out.auth_status = r.status;
    const j = await r.json();
    out.auth_body = j;
    if (j.apiKey) {
      const r2 = await fetch("https://api.pluggy.ai/items", {
        headers: { "X-API-KEY": j.apiKey },
      });
      out.items_status = r2.status;
      out.items_body = (await r2.text()).slice(0, 500);

      const r3 = await fetch("https://api.pluggy.ai/items?clientUserId=test", {
        headers: { "X-API-KEY": j.apiKey },
      });
      out.items_filter_status = r3.status;
      out.items_filter_body = (await r3.text()).slice(0, 500);

      const r4 = await fetch("https://api.pluggy.ai/connectors", {
        headers: { "X-API-KEY": j.apiKey },
      });
      out.connectors_status = r4.status;
      out.connectors_body = (await r4.text()).slice(0, 200);
    }
  } catch (e: any) {
    out.error = e.message;
  }
  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
