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
  threshold_silence_days: number;
}

interface ClientTicketInfo {
  client_id: string;
  total_ticket: number;
  multiplier: number;
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
  threshold_silence_days: 7,
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

      const settings: AccountSettings = { ...defaultSettings, ...settingsData };

      // Calculate ticket multipliers for all clients in this account
      const ticketInfo = await calculateTicketMultipliers(supabase, account.id);
      console.log(`Account ${account.id}: Average ticket = ${ticketInfo.averageTicket}, Clients with products = ${ticketInfo.clients.length}`);

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
          // Get ticket multiplier for this client (default to 1.0 if no products)
          const clientTicket = ticketInfo.clients.find(c => c.client_id === client.id);
          const ticketMultiplier = clientTicket?.multiplier || 1.0;
          
          console.log(`Client ${client.id}: Ticket multiplier = ${ticketMultiplier.toFixed(2)}`);

          // Calculate ROIzometer (0-100) - ticket affects impact weight
          const roizometer = await calculateRoizometer(supabase, client.id, account.id, settings, thirtyDaysAgo, ticketMultiplier);
          
          // Calculate E-Score (0-100) - ticket affects thresholds
          const escore = await calculateEScore(supabase, client.id, account.id, settings, thirtyDaysAgo, ticketMultiplier);
          
          // Check for silence risk (ticket affects silence threshold)
          await checkSilenceRisk(supabase, client.id, account.id, settings, ticketMultiplier);
          
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
            console.log(`Processed client ${client.id}: E=${escore}, ROI=${roizometer}, Q=${quadrant}, T=${trend}, Ticket=${ticketMultiplier.toFixed(2)}x`);

            // Update client status based on scores (ticket affects thresholds)
            const newStatus = determineClientStatus(escore, roizometer, settings, ticketMultiplier);
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

/**
 * Calculate ticket multipliers for all clients in an account
 * Multiplier = client_ticket / average_ticket
 * This means clients with higher tickets have multipliers > 1
 */
async function calculateTicketMultipliers(
  supabase: any,
  accountId: string
): Promise<{ averageTicket: number; clients: ClientTicketInfo[] }> {
  // Get all client_products with product prices
  const { data: clientProducts } = await supabase
    .from("client_products")
    .select(`
      client_id,
      products (
        price
      )
    `)
    .eq("account_id", accountId);

  if (!clientProducts || clientProducts.length === 0) {
    return { averageTicket: 0, clients: [] };
  }

  // Group by client and sum their product prices
  const clientTickets = new Map<string, number>();
  
  for (const cp of clientProducts) {
    const price = cp.products?.price || 0;
    const currentTotal = clientTickets.get(cp.client_id) || 0;
    clientTickets.set(cp.client_id, currentTotal + price);
  }

  // Calculate average ticket
  const tickets = Array.from(clientTickets.values());
  const averageTicket = tickets.length > 0 
    ? tickets.reduce((sum, t) => sum + t, 0) / tickets.length 
    : 0;

  // Calculate multipliers
  const clients: ClientTicketInfo[] = [];
  for (const [clientId, totalTicket] of clientTickets) {
    // Multiplier: client's ticket / average, capped between 0.5 and 3.0
    const rawMultiplier = averageTicket > 0 ? totalTicket / averageTicket : 1.0;
    const multiplier = Math.max(0.5, Math.min(3.0, rawMultiplier));
    
    clients.push({
      client_id: clientId,
      total_ticket: totalTicket,
      multiplier,
    });
  }

  return { averageTicket, clients };
}

async function calculateRoizometer(
  supabase: any,
  clientId: string,
  accountId: string,
  settings: AccountSettings,
  since: Date,
  ticketMultiplier: number
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

  // Impact score is boosted by ticket multiplier
  const impactScore = (impact: string) => {
    const baseScore = impact === "high" ? 3 : impact === "medium" ? 2 : 1;
    // Higher ticket = more weight on each ROI event
    return baseScore * ticketMultiplier;
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
  since: Date,
  ticketMultiplier: number
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

  // Higher ticket clients are expected to engage more, so we apply sensitivity
  // More engagement expected = higher bar to achieve same score
  const engagementSensitivity = Math.sqrt(ticketMultiplier); // Moderate effect

  // Score based on message activity (adjusted for ticket)
  let whatsappScore = 0;
  if (messageCount > 0) {
    const expectedMessages = 30 * engagementSensitivity;
    const expectedClientMessages = 15 * engagementSensitivity;
    
    const frequencyScore = Math.min(1, messageCount / expectedMessages);
    const responseScore = Math.min(1, clientMessages / expectedClientMessages);
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
    
    // Higher ticket = higher expectation for attendance
    const attendanceExpectation = 0.7 + (ticketMultiplier - 1) * 0.1; // 70% base + ticket bonus
    const adjustedAttendance = Math.min(1, attendanceRate / attendanceExpectation);
    
    presenceScore = Math.round(
      (adjustedAttendance * 0.5 + Math.min(1, avgDuration / 3600) * 0.3 + punctualityScore * 0.2) 
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
    
    // Higher ticket = more participation expected
    const expectedInteractions = 20 * engagementSensitivity;
    
    participationScore = Math.min(
      settings.escore_live_participation,
      Math.round((Math.min(1, totalInteractions / expectedInteractions) + typeBonus) * settings.escore_live_participation)
    );
  }

  return Math.min(100, whatsappScore + presenceScore + participationScore);
}

/**
 * Check if client has been silent too long and create risk event
 * Higher ticket clients have shorter silence thresholds
 */
async function checkSilenceRisk(
  supabase: any,
  clientId: string,
  accountId: string,
  settings: AccountSettings,
  ticketMultiplier: number
): Promise<void> {
  // Get last message from client
  const { data: lastMessage } = await supabase
    .from("message_events")
    .select("sent_at")
    .eq("client_id", clientId)
    .eq("account_id", accountId)
    .eq("direction", "client_to_team")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastMessage) return;

  const lastMessageDate = new Date(lastMessage.sent_at);
  const daysSinceLastMessage = Math.floor((Date.now() - lastMessageDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Adjust silence threshold based on ticket
  // Higher ticket = shorter threshold (more sensitive)
  const adjustedThreshold = Math.round(settings.threshold_silence_days / ticketMultiplier);
  const minThreshold = 3; // Never less than 3 days
  const effectiveThreshold = Math.max(minThreshold, adjustedThreshold);

  if (daysSinceLastMessage >= effectiveThreshold) {
    // Check if we already have a recent silence risk event
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: existingRisk } = await supabase
      .from("risk_events")
      .select("id")
      .eq("client_id", clientId)
      .eq("source", "system")
      .ilike("reason", "%silêncio%")
      .gte("happened_at", sevenDaysAgo.toISOString())
      .limit(1);

    if (!existingRisk || existingRisk.length === 0) {
      // Determine risk level based on ticket and days silent
      let riskLevel: "low" | "medium" | "high" = "low";
      if (ticketMultiplier >= 1.5 || daysSinceLastMessage >= effectiveThreshold * 2) {
        riskLevel = "high";
      } else if (ticketMultiplier >= 1.0 || daysSinceLastMessage >= effectiveThreshold * 1.5) {
        riskLevel = "medium";
      }

      await supabase.from("risk_events").insert({
        account_id: accountId,
        client_id: clientId,
        source: "system",
        risk_level: riskLevel,
        reason: `Silêncio de ${daysSinceLastMessage} dias (cliente ticket ${ticketMultiplier >= 1.5 ? 'alto' : ticketMultiplier >= 1.0 ? 'médio' : 'baixo'})`,
        evidence_snippet: `Última mensagem: ${lastMessageDate.toLocaleDateString('pt-BR')}`,
        happened_at: new Date().toISOString(),
      });

      console.log(`Created silence risk event for client ${clientId}: ${daysSinceLastMessage} days, threshold ${effectiveThreshold}, level ${riskLevel}`);
    }
  }
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

/**
 * Determine client status based on scores
 * Ticket multiplier affects thresholds - high ticket clients enter churn_risk sooner
 */
function determineClientStatus(
  escore: number, 
  roizometer: number, 
  settings: AccountSettings,
  ticketMultiplier: number
): string | null {
  // Adjust thresholds based on ticket
  // Higher ticket = higher thresholds (enter churn_risk earlier)
  const escoreThreshold = settings.threshold_low_escore * ticketMultiplier;
  const roiThreshold = settings.threshold_low_roizometer * ticketMultiplier;

  if (escore < escoreThreshold && roizometer < roiThreshold) {
    return "churn_risk";
  }
  if (escore >= 50 && roizometer >= 50) {
    return "active";
  }
  return null; // Don't change status
}
