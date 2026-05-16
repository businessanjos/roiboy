import { pluggyFetch } from "../_shared/pluggy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    // itemId opcional: passar quando for "atualizar" credenciais de um item existente
    const itemId: string | undefined = body.itemId;
    const clientUserId: string | undefined = body.clientUserId;

    const payload: Record<string, unknown> = {};
    if (clientUserId) payload.clientUserId = clientUserId;
    if (itemId) payload.itemId = itemId;

    const r = await pluggyFetch("/connect_token", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return new Response(
      JSON.stringify({ success: true, accessToken: r.accessToken }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("pluggy-create-connect-token:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
