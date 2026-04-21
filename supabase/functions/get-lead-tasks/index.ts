import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateRequestWithLegacy,
  unauthorizedResponse,
  logApiKeyUsage,
} from "../_shared/api-key-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const leadId = url.searchParams.get("lead_id");

    if (!leadId || !UUID_REGEX.test(leadId)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid lead_id parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const auth = await authenticateRequestWithLegacy(req, supabase);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    // Fetch tasks with assigned user name
    const { data: tasks, error } = await supabase
      .from("internal_tasks")
      .select("id, title, description, status, priority, due_date, due_time, assigned_to, created_at, completed_at, meeting_url, meeting_platform, custom_status_id, users!internal_tasks_assigned_to_fkey(name)")
      .eq("lead_id", leadId)
      .eq("account_id", auth.accountId)
      .order("due_date", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Database error:", error.code);
      if (auth.method === "api_key" && auth.apiKeyId) {
        await logApiKeyUsage(supabase, auth.apiKeyId, req, 500);
      }
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (auth.method === "api_key" && auth.apiKeyId) {
      await logApiKeyUsage(supabase, auth.apiKeyId, req, 200);
    }

    const formattedTasks = (tasks || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      due_time: t.due_time,
      assigned_to: t.assigned_to,
      assigned_user_name: t.users?.name || null,
      created_at: t.created_at,
      completed_at: t.completed_at,
      meeting_url: t.meeting_url,
      meeting_platform: t.meeting_platform,
    }));

    return new Response(
      JSON.stringify({
        found: formattedTasks.length > 0,
        count: formattedTasks.length,
        tasks: formattedTasks,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Request processing error");
    return new Response(JSON.stringify({ error: "Request failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
