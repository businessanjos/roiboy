import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all conversation IDs from diretoria sector
    const { data: convs, error: convErr } = await supabase
      .from("zapp_conversations")
      .select("id")
      .eq("sector_id", "diretoria");

    if (convErr) throw convErr;

    const convIds = (convs || []).map((c: any) => c.id);
    console.log(`Found ${convIds.length} conversations to delete`);

    if (convIds.length === 0) {
      return new Response(JSON.stringify({ message: "No diretoria conversations found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete in batches of 20 conversations at a time
    const batchSize = 20;
    let totalMessages = 0;
    let totalAssignments = 0;

    for (let i = 0; i < convIds.length; i += batchSize) {
      const batch = convIds.slice(i, i + batchSize);

      // Delete messages
      const { count: msgCount } = await supabase
        .from("zapp_messages")
        .delete({ count: "exact" })
        .in("zapp_conversation_id", batch);
      totalMessages += (msgCount || 0);

      // Delete assignments
      const { count: assignCount } = await supabase
        .from("zapp_conversation_assignments")
        .delete({ count: "exact" })
        .in("zapp_conversation_id", batch);
      totalAssignments += (assignCount || 0);

      // Delete conversation tags
      await supabase
        .from("zapp_conversation_tags")
        .delete()
        .in("zapp_conversation_id", batch);

      console.log(`Batch ${Math.floor(i / batchSize) + 1}: deleted msgs=${msgCount}, assignments=${assignCount}`);
    }

    // Delete conversations
    const { count: convCount } = await supabase
      .from("zapp_conversations")
      .delete({ count: "exact" })
      .eq("sector_id", "diretoria");

    // Delete departments
    await supabase
      .from("zapp_departments")
      .delete()
      .eq("sector_id", "diretoria");

    // Delete integrations
    await supabase
      .from("integrations")
      .delete()
      .eq("sector_id", "diretoria");

    const result = {
      deleted: {
        messages: totalMessages,
        assignments: totalAssignments,
        conversations: convCount,
      },
      message: "Setor diretoria completamente removido",
    };

    console.log("Cleanup complete:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
