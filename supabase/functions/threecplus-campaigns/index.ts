import { createClient } from "npm:@supabase/supabase-js@2";
import {
  fetch3c,
  resolveAgentAuth,
  with3cContext,
} from "../_shared/threecplus.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getBaseDomain(domain: string | null): string {
  if (!domain) return "https://eternumentoringclub1.3c.plus";
  let base = domain.trim();
  base = base.replace(/\/login\/?$/, "");
  base = base.replace(/\/agent\/?.*$/, "");
  base = base.replace(/\/supervisor\/?.*$/, "");
  base = base.replace(/\/$/, "");
  if (!base.startsWith("http")) base = "https://" + base;
  return base;
}

async function fetchCampaignsFromDomain(domain: string, apiToken: string): Promise<{ campaigns: any[]; error?: string }> {
  let allCampaigns: any[] = [];
  let currentPage = 1;
  let hasMore = true;

  while (hasMore) {
    const apiResponse = await fetch3c(
      `${domain}/api/v1/agent/campaigns?api_token=${apiToken}&per_page=100&page=${currentPage}`,
      { method: "GET", headers: { Accept: "application/json" } }
    );
    const responseText = await apiResponse.text();
    console.log(`[threecplus-campaigns] Page ${currentPage} from ${domain}:`, apiResponse.status, responseText.substring(0, 500));

    if (!apiResponse.ok) {
      return { campaigns: [], error: `Erro ao buscar campanhas (status ${apiResponse.status}).` };
    }
    if (responseText.trim().startsWith("<!DOCTYPE") || responseText.trim().startsWith("<html")) {
      return { campaigns: [], error: "Erro de configuração: o domínio do 3C Plus parece incorreto." };
    }

    let parsed;
    try { parsed = JSON.parse(responseText); } catch { parsed = null; hasMore = false; break; }

    if (Array.isArray(parsed)) {
      allCampaigns = parsed;
      hasMore = false;
    } else if (parsed?.data && Array.isArray(parsed.data)) {
      allCampaigns.push(...parsed.data);
      hasMore = parsed.current_page < parsed.last_page;
      currentPage++;
    } else {
      hasMore = false;
    }
    if (currentPage > 10) break;
  }
  return { campaigns: allCampaigns };
}

Deno.serve((req) => with3cContext(async () => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("id, account_id, name, email")
      .eq("auth_user_id", user.id)
      .single();

    if (!userData) {
      return new Response(JSON.stringify({ success: false, error: "Usuário não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Token de serviço + X-Agent-Id, com fallback ao token individual/da conta
    const auth = await resolveAgentAuth(supabaseAdmin, {
      userId: userData.id,
      accountId: userData.account_id,
      userEmail: userData.email,
      userName: userData.name,
    });

    if (!auth.apiToken) {
      return new Response(JSON.stringify({ success: false, code: "NO_INTEGRATION", error: "3C Plus não configurado." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiToken = auth.apiToken;
    const baseDomain = auth.baseDomain;
    console.log("[threecplus-campaigns] Account:", userData.account_id, "Domain:", baseDomain);

    const result = await fetchCampaignsFromDomain(baseDomain, apiToken);

    // Fallback to default domain
    const defaultDomain = "https://eternumentoringclub1.3c.plus";
    if (result.campaigns.length === 0 && baseDomain !== defaultDomain) {
      const fallbackResult = await fetchCampaignsFromDomain(defaultDomain, apiToken);
      if (fallbackResult.campaigns.length > 0) {
        console.log(`[threecplus-campaigns] Default fallback succeeded: ${fallbackResult.campaigns.length} campaigns`);
        return new Response(JSON.stringify({ success: true, campaigns: fallbackResult.campaigns }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (result.error && result.campaigns.length === 0) {
      return new Response(JSON.stringify({ success: false, error: result.error }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, campaigns: result.campaigns }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[threecplus-campaigns] Error:", err);
    return new Response(JSON.stringify({ success: false, error: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}));
