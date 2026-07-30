import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureFreshToken } from "../_shared/metaToken.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const { accountId, profileId, force, resync = true } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let query = supabase
      .from("instagram_profiles")
      .select("id, account_id, username, meta_access_token, token_expires_at, sync_error")
      .eq("is_active", true)
      .not("meta_access_token", "is", null);

    if (accountId) query = query.eq("account_id", accountId);
    if (profileId) query = query.eq("id", profileId);

    const { data: profiles, error } = await query;
    if (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const details: any[] = [];
    const accountsToResync = new Set<string>();

    for (const profile of profiles ?? []) {
      const res = await ensureFreshToken(supabase, profile, { force: !!force });
      details.push({
        username: profile.username,
        refreshed: res.refreshed,
        error: res.error ?? null,
      });
      if (res.refreshed) accountsToResync.add(profile.account_id);
    }

    // Retoma a sincronização automaticamente para as contas com token renovado
    if (resync) {
      for (const acc of accountsToResync) {
        try {
          await supabase.functions.invoke("sync-instagram-profiles", { body: { accountId: acc } });
        } catch (e) {
          console.error("resync failed", acc, (e as Error).message);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: profiles?.length ?? 0,
        refreshed: details.filter((d) => d.refreshed).length,
        resynced_accounts: [...accountsToResync].length,
        details,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("refresh-meta-tokens error", e);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
