import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { action, token, email } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the share by token
    const { data: share } = await supabaseAdmin
      .from("insights_dashboard_shares")
      .select("id, dashboard_id, is_active, account_id")
      .eq("share_token", token)
      .single();

    if (!share) {
      return new Response(JSON.stringify({ error: "not_found", message: "Link inválido ou expirado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!share.is_active) {
      return new Response(JSON.stringify({ error: "inactive", message: "Este link foi desativado pelo proprietário" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: validate — just check if token exists and is active
    if (action === "validate") {
      return new Response(JSON.stringify({ valid: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: request_access — create or check access request
    if (action === "request_access") {
      if (!email) {
        return new Response(JSON.stringify({ error: "Email obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Check existing request
      const { data: existingRequest } = await supabaseAdmin
        .from("insights_share_access_requests")
        .select("id, status, request_count")
        .eq("share_id", share.id)
        .eq("email", normalizedEmail)
        .single();

      if (existingRequest) {
        if (existingRequest.status === "approved") {
          // Fetch dashboard data
          const dashboardData = await fetchDashboardData(supabaseAdmin, share.dashboard_id);
          return new Response(JSON.stringify({ status: "approved", ...dashboardData }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (existingRequest.status === "rejected") {
          return new Response(JSON.stringify({ status: "rejected", message: "Seu acesso foi recusado pelo proprietário" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Pending — increment request count
        await supabaseAdmin
          .from("insights_share_access_requests")
          .update({ request_count: existingRequest.request_count + 1 })
          .eq("id", existingRequest.id);

        return new Response(JSON.stringify({ status: "pending", message: "Aguardando aprovação do proprietário" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create new request
      const { error: insertError } = await supabaseAdmin
        .from("insights_share_access_requests")
        .insert({
          share_id: share.id,
          email: normalizedEmail,
          status: "pending",
        });

      if (insertError) {
        return new Response(JSON.stringify({ error: "Erro ao solicitar acesso" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: "pending", message: "Solicitação enviada! Aguarde a aprovação do proprietário." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: check_access — check status for given email
    if (action === "check_access") {
      if (!email) {
        return new Response(JSON.stringify({ error: "Email obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const { data: request } = await supabaseAdmin
        .from("insights_share_access_requests")
        .select("status")
        .eq("share_id", share.id)
        .eq("email", normalizedEmail)
        .single();

      if (!request) {
        return new Response(JSON.stringify({ status: "no_request" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (request.status === "approved") {
        const dashboardData = await fetchDashboardData(supabaseAdmin, share.dashboard_id);
        return new Response(JSON.stringify({ status: "approved", ...dashboardData }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: request.status }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("shared-insights error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fetchDashboardData(supabase: any, dashboardId: string) {
  const { data: dashboard } = await supabase
    .from("insights_dashboards")
    .select("id, name")
    .eq("id", dashboardId)
    .single();

  const { data: visuals } = await supabase
    .from("insights_visuals")
    .select("id, dashboard_id, title, chart_type, config, layout")
    .eq("dashboard_id", dashboardId)
    .order("created_at", { ascending: true });

  return {
    dashboard: dashboard || null,
    visuals: visuals || [],
  };
}
