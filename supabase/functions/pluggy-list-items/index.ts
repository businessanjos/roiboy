import { pluggyFetch } from "../_shared/pluggy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lista itens Pluggy associados a um clientUserId (que aqui usamos como bank_account_id).
// Útil para recuperar conexões pendentes quando o redirect do widget falhou,
// mas o usuário concluiu a autorização no app do banco.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { clientUserId } = await req.json().catch(() => ({}));
    if (!clientUserId) throw new Error("clientUserId é obrigatório");

    const r = await pluggyFetch(
      `/items?clientUserId=${encodeURIComponent(clientUserId)}`,
    );

    const items = (r.results ?? r.items ?? []).map((it: any) => ({
      id: it.id,
      status: it.status,
      executionStatus: it.executionStatus,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
      institution: it.connector?.name ?? "Desconhecido",
      institutionImage: it.connector?.imageUrl ?? null,
    }));

    return new Response(
      JSON.stringify({ success: true, items }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("pluggy-list-items:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
