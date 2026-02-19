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
    if (req.method === "POST") {
      // Request access
      const { share_token, email } = await req.json();

      if (!share_token || !email) {
        return new Response(JSON.stringify({ error: "Token e email são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response(JSON.stringify({ error: "Email inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find active share
      const { data: share, error: shareError } = await supabaseAdmin
        .from("insights_dashboard_shares")
        .select("*, insights_dashboards(name, account_id)")
        .eq("share_token", share_token)
        .eq("is_active", true)
        .single();

      if (shareError || !share) {
        return new Response(JSON.stringify({ error: "Link de compartilhamento inválido ou expirado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if request already exists
      const { data: existing } = await supabaseAdmin
        .from("insights_share_access_requests")
        .select("id, status")
        .eq("share_id", share.id)
        .eq("email", email.toLowerCase())
        .single();

      if (existing) {
        return new Response(JSON.stringify({ status: existing.status, request_id: existing.id }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create access request
      const { data: request, error: reqError } = await supabaseAdmin
        .from("insights_share_access_requests")
        .insert({ share_id: share.id, email: email.toLowerCase() })
        .select("id, status")
        .single();

      if (reqError) {
        return new Response(JSON.stringify({ error: "Erro ao criar solicitação" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create notification for the share creator
      const dashboardName = (share as any).insights_dashboards?.name || "Painel";
      await supabaseAdmin.from("notifications").insert({
        account_id: share.account_id,
        user_id: share.created_by,
        type: "dashboard_share_request",
        title: "Solicitação de acesso ao painel",
        content: `${email} solicitou acesso ao painel "${dashboardName}"`,
        link: `/insights/${share.dashboard_id}`,
        source_type: "insights_share_request",
        source_id: request!.id,
      });

      return new Response(JSON.stringify({ status: "pending", request_id: request!.id }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      const email = url.searchParams.get("email");

      if (!token) {
        return new Response(JSON.stringify({ error: "Token obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate share
      const { data: share } = await supabaseAdmin
        .from("insights_dashboard_shares")
        .select("id, dashboard_id, account_id, is_active")
        .eq("share_token", token)
        .eq("is_active", true)
        .single();

      if (!share) {
        return new Response(JSON.stringify({ error: "Link inválido ou expirado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If no email, return share info (dashboard name)
      if (!email) {
        const { data: dashboard } = await supabaseAdmin
          .from("insights_dashboards")
          .select("name")
          .eq("id", share.dashboard_id)
          .single();

        return new Response(JSON.stringify({ valid: true, dashboard_name: dashboard?.name }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check access
      const { data: accessReq } = await supabaseAdmin
        .from("insights_share_access_requests")
        .select("status")
        .eq("share_id", share.id)
        .eq("email", email.toLowerCase())
        .single();

      if (!accessReq) {
        return new Response(JSON.stringify({ status: "not_found" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (accessReq.status !== "approved") {
        return new Response(JSON.stringify({ status: accessReq.status }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Approved — fetch dashboard + visuals
      const { data: dashboard } = await supabaseAdmin
        .from("insights_dashboards")
        .select("*")
        .eq("id", share.dashboard_id)
        .single();

      const { data: visuals } = await supabaseAdmin
        .from("insights_visuals")
        .select("*")
        .eq("dashboard_id", share.dashboard_id)
        .order("created_at");

      return new Response(
        JSON.stringify({ status: "approved", dashboard, visuals }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
