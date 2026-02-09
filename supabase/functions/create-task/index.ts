import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateRequestWithLegacy,
  unauthorizedResponse,
} from "../_shared/api-key-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const auth = await authenticateRequestWithLegacy(req, supabase);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    const accountId = auth.accountId;
    if (!accountId) {
      return unauthorizedResponse(corsHeaders, "Account not found");
    }

    const payload = await req.json();

    if (!payload.deal_id) {
      return new Response(
        JSON.stringify({ error: "deal_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const now = new Date();
    const dueDate = payload.due_date || now.toISOString().split("T")[0];
    const dueTime =
      payload.due_time || now.toTimeString().split(" ")[0].slice(0, 5);

    const { data: task, error: taskError } = await supabase
      .from("internal_tasks")
      .insert({
        account_id: accountId,
        deal_id: payload.deal_id,
        lead_id: payload.lead_id || null,
        title: payload.title || "Primeiro Contato Realizado",
        activity_type_id: payload.activity_type_id || null,
        assigned_to: payload.assigned_to || null,
        created_by: payload.assigned_to || null,
        priority: payload.priority || "medium",
        status: "pending",
        due_date: dueDate,
        due_time: dueTime,
      })
      .select("id")
      .single();

    if (taskError) {
      console.error("Error creating task:", taskError);
      return new Response(
        JSON.stringify({ error: "Failed to create task", details: taskError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, task: { id: task.id } }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
