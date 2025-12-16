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
  // V-NPS settings
  vnps_risk_weight_low: number;
  vnps_risk_weight_medium: number;
  vnps_risk_weight_high: number;
  vnps_eligible_min_score: number;
  vnps_eligible_max_risk: number;
  vnps_eligible_min_escore: number;
}

interface ClientTicketInfo {
  client_id: string;
  total_ticket: number;
  multiplier: number;
}

interface VNPSResult {
  vnps_score: number;
  vnps_class: "detractor" | "neutral" | "promoter";
  risk_index: number;
  explanation: string;
  eligible_for_nps_ask: boolean;
  trend: "up" | "flat" | "down";
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
  // V-NPS defaults
  vnps_risk_weight_low: 5,
  vnps_risk_weight_medium: 15,
  vnps_risk_weight_high: 30,
  vnps_eligible_min_score: 9.0,
  vnps_eligible_max_risk: 20,
  vnps_eligible_min_escore: 60,
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
            // Calculate and save V-NPS
            const vnpsResult = await calculateVNPS(supabase, client.id, account.id, escore, roizometer, settings);
            
            const { error: vnpsError } = await supabase
              .from("vnps_snapshots")
              .insert({
                account_id: account.id,
                client_id: client.id,
                vnps_score: vnpsResult.vnps_score,
                vnps_class: vnpsResult.vnps_class,
                roizometer,
                escore,
                risk_index: vnpsResult.risk_index,
                trend: vnpsResult.trend,
                explanation: vnpsResult.explanation,
                eligible_for_nps_ask: vnpsResult.eligible_for_nps_ask,
                computed_at: new Date().toISOString(),
              });

            if (vnpsError) {
              console.error("Error creating V-NPS snapshot:", vnpsError);
            } else {
              console.log(`V-NPS for client ${client.id}: ${vnpsResult.vnps_score} (${vnpsResult.vnps_class})`);
            }

            accountResult.clients_processed++;
            console.log(`Processed client ${client.id}: E=${escore}, ROI=${roizometer}, Q=${quadrant}, T=${trend}, V-NPS=${vnpsResult.vnps_score}`);

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
 * Calculate V-NPS (Live NPS) based on ROIzometer, E-Score, and Risk Index
 * Formula: V_NPS = ((ROIzometro * 0.5) + (EScore * 0.3) + ((100 - RiskIndex) * 0.2)) / 10
 */
async function calculateVNPS(
  supabase: any,
  clientId: string,
  accountId: string,
  escore: number,
  roizometer: number,
  settings: AccountSettings
): Promise<VNPSResult> {
  // Calculate Risk Index from risk_events using settings
  const riskIndex = await calculateRiskIndex(supabase, clientId, accountId, settings);
  
  // Apply V-NPS formula
  const vnpsRaw = (roizometer * 0.5) + (escore * 0.3) + ((100 - riskIndex) * 0.2);
  const vnpsScore = Math.round(vnpsRaw / 10 * 10) / 10; // Round to 1 decimal
  
  // Classify V-NPS (same as traditional NPS)
  let vnpsClass: "detractor" | "neutral" | "promoter";
  if (vnpsScore >= 9.0) {
    vnpsClass = "promoter";
  } else if (vnpsScore >= 7.0) {
    vnpsClass = "neutral";
  } else {
    vnpsClass = "detractor";
  }
  
  // Get previous V-NPS to determine trend
  const { data: prevVnps } = await supabase
    .from("vnps_snapshots")
    .select("vnps_score")
    .eq("client_id", clientId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let trend: "up" | "flat" | "down" = "flat";
  if (prevVnps) {
    const diff = vnpsScore - prevVnps.vnps_score;
    if (diff >= 0.5) trend = "up";
    else if (diff <= -0.5) trend = "down";
  }
  
  // Generate explanation
  const explanation = generateVNPSExplanation(vnpsScore, vnpsClass, roizometer, escore, riskIndex, trend);
  
  // Determine eligibility for NPS ask using configurable thresholds
  const eligibleForNpsAsk = 
    vnpsScore >= settings.vnps_eligible_min_score && 
    riskIndex <= settings.vnps_eligible_max_risk && 
    escore >= settings.vnps_eligible_min_escore;
  
  return {
    vnps_score: vnpsScore,
    vnps_class: vnpsClass,
    risk_index: riskIndex,
    explanation,
    eligible_for_nps_ask: eligibleForNpsAsk,
    trend,
  };
}

/**
 * Calculate Risk Index (0-100) from risk_events
 * Uses configurable weights from settings
 * - Recent events (<14 days) have higher weight
 * - Risk decays over time
 */
async function calculateRiskIndex(
  supabase: any,
  clientId: string,
  accountId: string,
  settings: AccountSettings
): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data: riskEvents } = await supabase
    .from("risk_events")
    .select("risk_level, happened_at")
    .eq("client_id", clientId)
    .eq("account_id", accountId)
    .gte("happened_at", thirtyDaysAgo.toISOString());

  if (!riskEvents || riskEvents.length === 0) {
    return 0;
  }

  const now = Date.now();
  let totalRisk = 0;

  for (const event of riskEvents) {
    // Base weight by level using configurable settings
    let baseWeight = settings.vnps_risk_weight_low; // low
    if (event.risk_level === "medium") baseWeight = settings.vnps_risk_weight_medium;
    else if (event.risk_level === "high") baseWeight = settings.vnps_risk_weight_high;

    // Recency factor: events in last 14 days get full weight, older events decay
    const eventDate = new Date(event.happened_at).getTime();
    const daysAgo = (now - eventDate) / (1000 * 60 * 60 * 24);
    
    let recencyMultiplier = 1.0;
    if (daysAgo > 14) {
      // Decay for events older than 14 days (down to 0.5 at 30 days)
      recencyMultiplier = Math.max(0.5, 1 - ((daysAgo - 14) / 32));
    } else if (daysAgo <= 7) {
      // Boost for very recent events
      recencyMultiplier = 1.2;
    }

    totalRisk += baseWeight * recencyMultiplier;
  }

  // Cap at 100
  return Math.min(100, Math.round(totalRisk));
}

/**
 * Generate human-readable explanation for V-NPS score
 */
function generateVNPSExplanation(
  vnpsScore: number,
  vnpsClass: string,
  roizometer: number,
  escore: number,
  riskIndex: number,
  trend: string
): string {
  const parts: string[] = [];
  
  // Class description
  const classDesc = vnpsClass === "promoter" ? "promotor" : vnpsClass === "neutral" ? "neutro" : "detrator";
  parts.push(`V-NPS ${classDesc}`);
  
  // Main factors
  const factors: string[] = [];
  
  // ROI perception
  if (roizometer >= 70) {
    factors.push("alta percepção de ROI");
  } else if (roizometer <= 30) {
    factors.push("baixa percepção de ROI");
  }
  
  // Engagement
  if (escore >= 70) {
    factors.push("engajamento forte");
  } else if (escore <= 30) {
    factors.push("engajamento fraco");
  } else if (trend === "down") {
    factors.push("queda de engajamento");
  }
  
  // Risk
  if (riskIndex >= 50) {
    factors.push("risco alto recente");
  } else if (riskIndex >= 25) {
    factors.push("risco médio recente");
  }
  
  // Build explanation
  if (factors.length > 0) {
    if (vnpsScore >= 7) {
      parts.push("sustentado por " + factors.join(" e "));
    } else {
      parts.push("puxado para baixo por " + factors.join(" e "));
    }
  }
  
  // Trend note
  if (trend === "up") {
    parts.push("(tendência de alta)");
  } else if (trend === "down") {
    parts.push("(tendência de queda)");
  }
  
  return parts.join(" ");
}

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
