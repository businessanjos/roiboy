import { callMcpTool } from "../_shared/banco-mcp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Connection {
  id: string;
  institution?: string;
  status?: string;
  accounts?: Array<{ id: string; name?: string; number?: string; type?: string; balance?: number }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Lista conexões (consents) ativas
    const connections = await callMcpTool<Connection[] | { connections: Connection[] }>(
      "openfinance_list_connections",
      {}
    );
    const list: Connection[] = Array.isArray(connections)
      ? connections
      : (connections?.connections ?? []);

    // Para cada conexão, expandir contas
    const flat: Array<{
      connection_id: string;
      institution: string;
      account_id: string;
      account_name: string;
      account_number: string;
      account_type: string;
      balance: number | null;
    }> = [];

    for (const c of list) {
      const accounts = c.accounts ?? [];
      // Se não vierem inline, tentar tool específico
      let resolved = accounts;
      if (resolved.length === 0) {
        try {
          const r = await callMcpTool<any>("openfinance_list_accounts", { connection_id: c.id });
          resolved = Array.isArray(r) ? r : (r?.accounts ?? []);
        } catch {
          /* ignora — algumas conexões não retornam contas */
        }
      }
      for (const a of resolved) {
        flat.push({
          connection_id: c.id,
          institution: c.institution ?? "Open Finance",
          account_id: String(a.id),
          account_name: a.name ?? `Conta ${a.number ?? a.id}`,
          account_number: a.number ?? "",
          account_type: a.type ?? "checking",
          balance: typeof a.balance === "number" ? a.balance : null,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, accounts: flat }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("openfinance-list-accounts error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
