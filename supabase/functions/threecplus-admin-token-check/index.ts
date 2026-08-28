import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async () => {
  const token = Deno.env.get("THREECPLUS_ADMIN_TOKEN");
  const domain = "https://anjosbusiness.3c.plus";

  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: "Token não configurado" }), { status: 500 });
  }

  const headers = { Authorization: `Bearer ${token}` };
  const results: any[] = [];

  try {
    const meRes = await fetch(`${domain}/api/v1/me`, { headers });
    results.push({ endpoint: "/api/v1/me", bearer_status: meRes.status });

    const queryRes = await fetch(`${domain}/api/v1/me?token=${encodeURIComponent(token)}`, { method: "GET" });
    results.push({ endpoint: "/api/v1/me?token=...", query_status: queryRes.status });
  } catch (err: any) {
    results.push({ error: err.message });
  }

  const ok = results.some((r) => r.bearer_status === 200 || r.query_status === 200);

  return new Response(JSON.stringify({ ok, token_length: token.length, results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
