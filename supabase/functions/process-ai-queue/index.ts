import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BATCH_SIZE = 10;
const MAX_PROCESSING_TIME_MS = 25000;

// ============================================
// JOB HANDLERS
// ============================================

// handleAiAnalysis removed — analyze-message edge function was decommissioned

async function handleClientAnalysis(
  supabase: any,
  job: { id: string; account_id: string; client_id: string | null; payload: Record<string, unknown> | null },
) {
  const p = job.payload || {};
  const linkedClientId = p.linked_client_id as string | null;
  const phone = p.phone as string;
  const profilePicUrl = p.profile_pic_url as string | null;
  const chatId = p.chat_id as string | null;
  const content = p.content as string;
  const timestamp = p.timestamp as string;
  const zappConversationId = p.zapp_conversation_id as string | null;
  const insertedMsgId = p.inserted_message_id as string | null;
  const accountId = job.account_id;

  if (linkedClientId) {
    // --- CLIENT PATH ---
    // Avatar update (only if client has no avatar)
    if (profilePicUrl) {
      const { data: clientData } = await supabase
        .from("clients")
        .select("avatar_url")
        .eq("id", linkedClientId)
        .maybeSingle();

      if (clientData && !clientData.avatar_url) {
        await supabase
          .from("clients")
          .update({ avatar_url: profilePicUrl })
          .eq("id", linkedClientId);
      }
    }

    // Find or create conversation (for client analysis)
    let conversationId: string | null = null;
    const { data: existingConvo } = await supabase
      .from("conversations")
      .select("id")
      .eq("account_id", accountId)
      .eq("client_id", linkedClientId)
      .eq("channel", "whatsapp")
      .maybeSingle();

    if (existingConvo) {
      conversationId = existingConvo.id;
    } else {
      const { data: newConvo } = await supabase
        .from("conversations")
        .insert({
          account_id: accountId,
          client_id: linkedClientId,
          channel: "whatsapp",
          external_thread_id: chatId,
        })
        .select("id")
        .single();
      if (newConvo) conversationId = newConvo.id;
    }

    // Insert message event
    await supabase
      .from("message_events")
      .insert({
        account_id: accountId,
        client_id: linkedClientId,
        conversation_id: conversationId,
        source: "whatsapp_text",
        direction: "client_to_team",
        content_text: content,
        sent_at: timestamp,
      });

    // AI analysis sub-job removed (analyze-message decommissioned)
  } else {
    // --- LEAD PATH ---
    const normalizedPhone = phone.replace(/^\+/, "");
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id, avatar_url")
      .eq("account_id", accountId)
      .or(`phone.eq.${normalizedPhone},phone.eq.${phone}`)
      .maybeSingle();

    if (existingLead) {
      if (profilePicUrl && !existingLead.avatar_url) {
        await supabase
          .from("leads")
          .update({ avatar_url: profilePicUrl })
          .eq("id", existingLead.id);
      }
      if (zappConversationId) {
        await supabase
          .from("zapp_conversations")
          .update({ lead_id: existingLead.id })
          .eq("id", zappConversationId);
      }
    }
  }

  return "completed";
}

async function handleClientSuggest(
  supabase: any,
  job: { id: string; account_id: string; payload: Record<string, unknown> | null },
) {
  const p = job.payload || {};
  const contactName = p.contact_name as string;
  const phone = p.phone as string | null;
  const zappConversationId = p.zapp_conversation_id as string;
  const accountId = job.account_id;

  const suggestions: { clientId: string; matchType: string; score: number; details: Record<string, unknown> }[] = [];

  // Name-based matching
  const nameParts = contactName
    .split(/[\s\-\/\(\)]+/)
    .filter((part: string) => part.length > 2)
    .slice(0, 3);

  for (const part of nameParts) {
    const { data: nameMatches } = await supabase
      .from("clients")
      .select("id, full_name, phone_e164")
      .eq("account_id", accountId)
      .eq("status", "active")
      .ilike("full_name", `%${part}%`)
      .limit(5);

    if (nameMatches) {
      for (const client of nameMatches) {
        const clientNameLower = (client.full_name || "").toLowerCase();
        const matchingParts = nameParts.filter((np: string) =>
          clientNameLower.includes(np.toLowerCase())
        ).length;
        const score = Math.min(0.95, 0.5 + matchingParts * 0.15);

        if (!suggestions.find((s) => s.clientId === client.id)) {
          suggestions.push({
            clientId: client.id,
            matchType: matchingParts > 1 ? "name" : "similar_name",
            score,
            details: {
              matchedPart: part,
              matchingParts,
              contactName,
              clientName: client.full_name,
            },
          });
        }
      }
    }
  }

  // Phone-based matching
  if (phone) {
    const phoneDigits = phone.replace(/\D/g, "");
    const partialPhone = phoneDigits.slice(-9);

    if (partialPhone.length >= 9) {
      const { data: phoneMatches } = await supabase
        .from("clients")
        .select("id, full_name, phone_e164")
        .eq("account_id", accountId)
        .eq("status", "active")
        .ilike("phone_e164", `%${partialPhone}`)
        .limit(5);

      if (phoneMatches) {
        for (const client of phoneMatches) {
          const existing = suggestions.find((s) => s.clientId === client.id);
          if (existing) {
            existing.score = Math.min(0.98, existing.score + 0.2);
            existing.matchType = "name";
            (existing.details as Record<string, unknown>).phoneMatch = true;
          } else {
            suggestions.push({
              clientId: client.id,
              matchType: "partial_phone",
              score: 0.7,
              details: { partialPhone, contactName, clientName: client.full_name },
            });
          }
        }
      }
    }
  }

  // Insert top 3 suggestions
  const topSuggestions = suggestions.sort((a, b) => b.score - a.score).slice(0, 3);

  for (const suggestion of topSuggestions) {
    await supabase.from("zapp_client_suggestions").insert({
      account_id: accountId,
      zapp_conversation_id: zappConversationId,
      suggested_client_id: suggestion.clientId,
      match_type: suggestion.matchType,
      match_score: suggestion.score,
      match_details: suggestion.details,
    }).maybeSingle();
  }

  return "completed";
}

// ============================================
// MAIN QUEUE PROCESSOR
// ============================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting AI queue processing...");

    // Clean up stale jobs (processing > 5 min)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: staleJobs } = await supabase
      .from("ai_analysis_queue")
      .update({
        status: "failed",
        error_message: "Timeout: job was processing for too long",
        completed_at: new Date().toISOString(),
      })
      .eq("status", "processing")
      .lt("started_at", fiveMinutesAgo)
      .select("id");

    if (staleJobs && staleJobs.length > 0) {
      console.log(`Cleaned up ${staleJobs.length} stale processing jobs`);
    }

    // Clean up exhausted jobs (max attempts exceeded)
    const { data: exhaustedJobs } = await supabase
      .from("ai_analysis_queue")
      .update({
        status: "failed",
        error_message: "Max attempts exceeded",
        completed_at: new Date().toISOString(),
      })
      .eq("status", "pending")
      .gte("attempts", 3)
      .select("id");

    if (exhaustedJobs && exhaustedJobs.length > 0) {
      console.log(`Cleaned up ${exhaustedJobs.length} exhausted jobs`);
    }

    // Fetch pending jobs
    const { data: jobs, error: fetchError } = await supabase
      .from("ai_analysis_queue")
      .select("id, account_id, message_id, client_id, attempts, job_type, payload")
      .eq("status", "pending")
      .lt("attempts", 3)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("Error fetching queue:", fetchError);
      throw fetchError;
    }

    if (!jobs || jobs.length === 0) {
      console.log("No pending jobs in queue");
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending jobs" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${jobs.length} pending jobs`);

    let processedCount = 0;
    let failedCount = 0;
    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const job of jobs) {
      if (Date.now() - startTime > MAX_PROCESSING_TIME_MS) {
        console.log("Approaching timeout, stopping batch processing");
        break;
      }

      const jobType = job.job_type || "ai_analysis";
      console.log(`Processing job ${job.id} (type: ${jobType})`);

      // Mark as processing
      await supabase
        .from("ai_analysis_queue")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
          attempts: job.attempts + 1,
        })
        .eq("id", job.id);

      try {
        let result: string;

        switch (jobType) {
          case "ai_analysis":
            // Decommissioned — mark as skipped
            result = "skipped";
          case "client_analysis":
            result = await handleClientAnalysis(supabase, job as { id: string; account_id: string; client_id: string | null; payload: Record<string, unknown> | null });
            break;
          case "client_suggest":
            result = await handleClientSuggest(supabase, job as { id: string; account_id: string; payload: Record<string, unknown> | null });
            break;
          default:
            console.warn(`Unknown job_type: ${jobType}, skipping`);
            result = "skipped";
        }

        // Mark as completed
        await supabase
          .from("ai_analysis_queue")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            ...(result === "skipped" ? { error_message: "Skipped: content too short or media" } : {}),
          })
          .eq("id", job.id);

        processedCount++;
        results.push({ id: job.id, status: result });
        console.log(`Job ${job.id} (${jobType}) ${result}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Job ${job.id} failed:`, errorMessage);

        const newAttempts = job.attempts + 1;
        if (newAttempts >= 3) {
          await supabase
            .from("ai_analysis_queue")
            .update({
              status: "failed",
              completed_at: new Date().toISOString(),
              error_message: errorMessage,
            })
            .eq("id", job.id);
          failedCount++;
          results.push({ id: job.id, status: "failed", error: errorMessage });
        } else {
          await supabase
            .from("ai_analysis_queue")
            .update({
              status: "pending",
              error_message: `Attempt ${newAttempts} failed: ${errorMessage}`,
            })
            .eq("id", job.id);
          results.push({ id: job.id, status: "retry", error: errorMessage });
        }
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`Queue complete. Processed: ${processedCount}, Failed: ${failedCount}, Time: ${totalTime}ms`);

    return new Response(
      JSON.stringify({
        processed: processedCount,
        failed: failedCount,
        total_jobs: jobs.length,
        processing_time_ms: totalTime,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Queue processing error:", errorMessage);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
