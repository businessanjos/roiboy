import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // IDs fixos do pipeline Closer e etapa Follow Up
    const FOLLOW_UP_STAGE_ID = "76e4dadc-286b-4302-a6d0-59698f45b70d";
    const REPESCAGEM_PIPELINE_ID = "205ffb2f-ecba-40a2-a583-591205a24f66";
    const ENTRADA_REPESCAGEM_STAGE_ID = "16919b90-9f5d-42ef-b7f9-752dd2cd2a0e";
    const DAYS_THRESHOLD = 31;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_THRESHOLD);

    // Find open deals in Follow Up stage older than threshold
    const { data: deals, error: fetchError } = await supabase
      .from("deals")
      .select("id, title")
      .eq("stage_id", FOLLOW_UP_STAGE_ID)
      .eq("status", "open")
      .lt("updated_at", cutoffDate.toISOString());

    if (fetchError) throw fetchError;

    if (!deals || deals.length === 0) {
      console.log("No deals to move to Repescagem");
      return new Response(
        JSON.stringify({ moved: 0, message: "No deals to move" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dealIds = deals.map((d) => d.id);

    // Move deals to Repescagem pipeline
    const { error: updateError } = await supabase
      .from("deals")
      .update({
        pipeline_id: REPESCAGEM_PIPELINE_ID,
        stage_id: ENTRADA_REPESCAGEM_STAGE_ID,
        updated_at: new Date().toISOString(),
      })
      .in("id", dealIds);

    if (updateError) throw updateError;

    // Log activity for each moved deal
    const activityNotes = deals.map((deal) => ({
      deal_id: deal.id,
      account_id: "796e7970-fd93-4574-a871-6090624cace6",
      type: "note",
      content: `Movido automaticamente para Repescagem (${DAYS_THRESHOLD}+ dias em Follow Up)`,
      created_at: new Date().toISOString(),
    }));

    await supabase.from("deal_activities").insert(activityNotes);

    console.log(`Moved ${deals.length} deals to Repescagem pipeline`);

    return new Response(
      JSON.stringify({
        moved: deals.length,
        deals: deals.map((d) => d.title),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto-repescagem error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
