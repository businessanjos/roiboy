import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AccountSettings {
  weight_whatsapp_text: number;
  weight_whatsapp_audio: number;
  weight_live_interaction: number;
  escore_whatsapp_engagement: number;
  escore_live_presence: number;
  escore_live_participation: number;
  threshold_low_escore: number;
  threshold_low_roizometer: number;
}

const defaultSettings: AccountSettings = {
  weight_whatsapp_text: 1.0,
  weight_whatsapp_audio: 1.5,
  weight_live_interaction: 2.0,
  escore_whatsapp_engagement: 40,
  escore_live_presence: 30,
  escore_live_participation: 30,
  threshold_low_escore: 30,
  threshold_low_roizometer: 30,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { account_id, client_id } = await req.json().catch(() => ({}));

    console.log("Starting score recalculation...", { account_id, client_id });

    // Get all accounts or specific account
    let accountsQuery = supabase.from("accounts").select("id");
    if (account_id) {
      accountsQuery = accountsQuery.eq("id", account_id);
    }
    const { data: accounts, error: accountsError } = await accountsQuery;
    
    if (accountsError) {
      console.error("Error fetching accounts:", accountsError);
      throw accountsError;
    }

    const results: { account_id: string; clients_processed: number; errors: string[] }[] = [];

    for (const account of accounts || []) {
      const accountResult = { account_id: account.id, clients_processed: 0, errors: [] as string[] };

      // Get settings for this account
      const { data: settingsData } = await supabase
        .from("account_settings")
        .select("*")
        .eq("account_id", account.id)
        .maybeSingle();

      const settings: AccountSettings = settingsData || defaultSettings;

      // Get clients for this account
      let clientsQuery = supabase.from("clients").select("id").eq("account_id", account.id);
      if (client_id) {
        clientsQuery = clientsQuery.eq("id", client_id);
      }
      const { data: clients, error: clientsError } = await clientsQuery;

      if (clientsError) {
        console.error("Error fetching clients:", clientsError);
        accountResult.errors.push(`Failed to fetch clients: ${clientsError.message}`);
        results.push(accountResult);
        continue;
      }

      // Get the last 30 days window
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const client of clients || []) {
        try {
          // Calculate ROIzometer (0-100)
          const roizometer = await calculateRoizometer(supabase, client.id, account.id, settings, thirtyDaysAgo);
          
          // Calculate E-Score (0-100)
          const escore = await calculateEScore(supabase, client.id, account.id, settings, thirtyDaysAgo);
          
          // Determine quadrant
          const quadrant = determineQuadrant(escore, roizometer);
          
          // Get previous score to determine trend
          const { data: prevSnapshot } = await supabase
            .from("score_snapshots")
            .select("escore, roizometer")
            .eq("client_id", client.id)
            .order("computed_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const trend = determineTrend(escore, roizometer, prevSnapshot);

          // Insert new score snapshot
          const { error: snapshotError } = await supabase
            .from("score_snapshots")
            .insert({
              account_id: account.id,
              client_id: client.id,
              escore,
              roizometer,
              quadrant,
              trend,
              computed_at: new Date().toISOString(),
            });

          if (snapshotError) {
            console.error("Error creating snapshot:", snapshotError);
            accountResult.errors.push(`Client ${client.id}: ${snapshotError.message}`);
          } else {
            accountResult.clients_processed++;
            console.log(`Processed client ${client.id}: E=${escore}, ROI=${roizometer}, Q=${quadrant}, T=${trend}`);

            // Update client status based on scores
            const newStatus = determineClientStatus(escore, roizometer, settings);
            if (newStatus) {
              await supabase
                .from("clients")
                .update({ status: newStatus })
                .eq("id", client.id);
            }
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`Error processing client ${client.id}:`, err);
          accountResult.errors.push(`Client ${client.id}: ${errorMessage}`);
        }
      }

      results.push(accountResult);
    }

    const totalProcessed = results.reduce((sum, r) => sum + r.clients_processed, 0);
    console.log(`Score recalculation complete. Total clients processed: ${totalProcessed}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${totalProcessed} clients`,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in recompute-scores:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function calculateRoizometer(
  supabase: any,
  clientId: string,
  accountId: string,
  settings: AccountSettings,
  since: Date
): Promise<number> {
  // Get ROI events in the window
  const { data: roiEvents } = await supabase
    .from("roi_events")
    .select("roi_type, category, impact, source")
    .eq("client_id", clientId)
    .eq("account_id", accountId)
    .gte("happened_at", since.toISOString());

  if (!roiEvents || roiEvents.length === 0) {
    return 0;
  }

  // Calculate tangible score (0-50)
  const tangibleCategories = ["revenue", "cost", "time", "process"];
  const tangibleEvents = roiEvents.filter((e: any) => tangibleCategories.includes(e.category));
  
  // Calculate intangible score (0-50)
  const intangibleCategories = ["clarity", "confidence", "tranquility", "status_direction"];
  const intangibleEvents = roiEvents.filter((e: any) => intangibleCategories.includes(e.category));

  const impactScore = (impact: string) => {
    switch (impact) {
      case "high": return 3;
      case "medium": return 2;
      case "low": return 1;
      default: return 1;
    }
  };

  const sourceWeight = (source: string) => {
    if (source === "whatsapp_audio") return settings.weight_whatsapp_audio;
    if (source === "whatsapp_text") return settings.weight_whatsapp_text;
    if (source === "zoom" || source === "google_meet") return settings.weight_live_interaction;
    return 1.0;
  };

  let tangibleScore = 0;
  for (const event of tangibleEvents) {
    tangibleScore += impactScore(event.impact) * sourceWeight(event.source);
  }
  tangibleScore = Math.min(50, Math.round(tangibleScore * 5)); // Scale to 0-50

  let intangibleScore = 0;
  for (const event of intangibleEvents) {
    intangibleScore += impactScore(event.impact) * sourceWeight(event.source);
  }
  intangibleScore = Math.min(50, Math.round(intangibleScore * 5)); // Scale to 0-50

  return tangibleScore + intangibleScore;
}

async function calculateEScore(
  supabase: any,
  clientId: string,
  accountId: string,
  settings: AccountSettings,
  since: Date
): Promise<number> {
  // WhatsApp engagement (0 to settings.escore_whatsapp_engagement)
  const { data: messages } = await supabase
    .from("message_events")
    .select("id, source, direction, sent_at")
    .eq("client_id", clientId)
    .eq("account_id", accountId)
    .gte("sent_at", since.toISOString());

  const messageCount = messages?.length || 0;
  const clientMessages = messages?.filter((m: any) => m.direction === "client_to_team").length || 0;
  const audioMessages = messages?.filter((m: any) => m.source === "whatsapp_audio_transcript").length || 0;

  // Score based on message activity (max points at 30+ messages)
  let whatsappScore = 0;
  if (messageCount > 0) {
    const frequencyScore = Math.min(1, messageCount / 30);
    const responseScore = Math.min(1, clientMessages / 15);
    const audioBonus = Math.min(0.3, audioMessages * 0.1);
    whatsappScore = Math.round((frequencyScore * 0.5 + responseScore * 0.5 + audioBonus) * settings.escore_whatsapp_engagement);
  }

  // Live presence (0 to settings.escore_live_presence)
  const { data: attendance } = await supabase
    .from("attendance")
    .select("id, duration_sec, join_delay_sec")
    .eq("client_id", clientId)
    .eq("account_id", accountId)
    .gte("join_time", since.toISOString());

  const { data: sessions } = await supabase
    .from("live_sessions")
    .select("id")
    .eq("account_id", accountId)
    .gte("start_time", since.toISOString());

  const totalSessions = sessions?.length || 0;
  const attendedSessions = attendance?.length || 0;
  
  let presenceScore = 0;
  if (totalSessions > 0) {
    const attendanceRate = attendedSessions / totalSessions;
    const avgDuration = attendance?.reduce((sum: number, a: any) => sum + (a.duration_sec || 0), 0) / (attendedSessions || 1);
    const punctualityScore = attendance?.filter((a: any) => (a.join_delay_sec || 0) < 300).length / (attendedSessions || 1);
    
    presenceScore = Math.round(
      (attendanceRate * 0.5 + Math.min(1, avgDuration / 3600) * 0.3 + punctualityScore * 0.2) 
      * settings.escore_live_presence
    );
  }

  // Live participation (0 to settings.escore_live_participation)
  const { data: interactions } = await supabase
    .from("live_interactions")
    .select("type, count")
    .eq("client_id", clientId)
    .eq("account_id", accountId)
    .gte("created_at", since.toISOString());

  let participationScore = 0;
  if (interactions && interactions.length > 0) {
    const totalInteractions = interactions.reduce((sum: number, i: any) => sum + (i.count || 1), 0);
    const typeBonus = new Set(interactions.map((i: any) => i.type)).size * 0.1;
    participationScore = Math.min(
      settings.escore_live_participation,
      Math.round((Math.min(1, totalInteractions / 20) + typeBonus) * settings.escore_live_participation)
    );
  }

  return Math.min(100, whatsappScore + presenceScore + participationScore);
}

function determineQuadrant(escore: number, roizometer: number): string {
  const highE = escore >= 50;
  const highROI = roizometer >= 50;

  if (highE && highROI) return "highE_highROI";
  if (highE && !highROI) return "highE_lowROI";
  if (!highE && highROI) return "lowE_highROI";
  return "lowE_lowROI";
}

function determineTrend(
  escore: number, 
  roizometer: number, 
  prevSnapshot: { escore: number; roizometer: number } | null
): string {
  if (!prevSnapshot) return "flat";

  const combined = escore + roizometer;
  const prevCombined = prevSnapshot.escore + prevSnapshot.roizometer;
  const diff = combined - prevCombined;

  if (diff > 10) return "up";
  if (diff < -10) return "down";
  return "flat";
}

function determineClientStatus(
  escore: number, 
  roizometer: number, 
  settings: AccountSettings
): string | null {
  if (escore < settings.threshold_low_escore && roizometer < settings.threshold_low_roizometer) {
    return "churn_risk";
  }
  if (escore >= 50 && roizometer >= 50) {
    return "active";
  }
  return null; // Don't change status
}
