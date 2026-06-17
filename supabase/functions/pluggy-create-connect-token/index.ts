import { pluggyFetch } from "../_shared/pluggy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PluggyConnector = {
  name?: string;
  isSandbox?: boolean;
};

async function getProductionConnectorDiagnostics() {
  const query = new URLSearchParams({
    countries: "BR",
    sandbox: "false",
    isOpenFinance: "true",
  });
  query.append("types", "PERSONAL_BANK");
  query.append("types", "BUSINESS_BANK");

  const response = await pluggyFetch(`/connectors?${query.toString()}`, { method: "GET" });
  const connectors = Array.isArray(response?.results)
    ? response.results
    : Array.isArray(response)
      ? response
      : [] as PluggyConnector[];
  const realBankConnectors = connectors.filter((connector: PluggyConnector) => {
    const name = String(connector?.name ?? "").toLowerCase();
    return connector?.isSandbox !== true && !name.includes("meu pluggy");
  });

  return {
    total: connectors.length,
    realBankTotal: realBankConnectors.length,
    sample: realBankConnectors.slice(0, 5).map((connector: PluggyConnector) => connector?.name).filter(Boolean),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    // itemId opcional: passar quando for "atualizar" credenciais de um item existente.
    // A Pluggy espera clientUserId/avoidDuplicates dentro de `options`; fora disso o token
    // pode abrir uma experiência genérica em vez do Connect direto para instituições.
    const itemId: string | undefined = body.itemId;
    const clientUserId: string | undefined = body.clientUserId;

    const payload: Record<string, unknown> = {
      options: {
        ...(clientUserId ? { clientUserId } : {}),
        avoidDuplicates: true,
      },
    };
    if (itemId) payload.itemId = itemId;

    const r = await pluggyFetch("/connect_token", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const connectorDiagnostics = await getProductionConnectorDiagnostics();

    return new Response(
      JSON.stringify({ success: true, accessToken: r.accessToken, connectorDiagnostics }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("pluggy-create-connect-token:", err);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
