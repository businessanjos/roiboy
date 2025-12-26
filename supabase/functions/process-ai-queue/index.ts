import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Configuration
const BATCH_SIZE = 10; // Process 10 jobs at a time
const MAX_PROCESSING_TIME_MS = 25000; // Leave buffer before timeout (30s edge function limit)

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting AI queue processing...");

    // Fetch pending jobs ordered by priority (higher first) and creation time
    const { data: jobs, error: fetchError } = await supabase
      .from("ai_analysis_queue")
      .select(`
        id,
        account_id,
        message_id,
        client_id,
        attempts
      `)
      .eq("status", "pending")
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
      // Check if we're running out of time
      if (Date.now() - startTime > MAX_PROCESSING_TIME_MS) {
        console.log("Approaching timeout, stopping batch processing");
        break;
      }

      console.log(`Processing job ${job.id} for message ${job.message_id}`);

      // Mark job as processing
      await supabase
        .from("ai_analysis_queue")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
          attempts: job.attempts + 1,
        })
        .eq("id", job.id);

      try {
        // Get the message content
        const { data: message, error: msgError } = await supabase
          .from("zapp_messages")
          .select("content")
          .eq("id", job.message_id)
          .single();

        if (msgError || !message) {
          throw new Error(`Message not found: ${job.message_id}`);
        }

        const content = message.content || "";
        
        // Skip if content is too short or is a media placeholder
        if (content.length <= 10 || content.startsWith("[")) {
          console.log(`Skipping job ${job.id} - content too short or media placeholder`);
          await supabase
            .from("ai_analysis_queue")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              error_message: "Skipped: content too short or media",
            })
            .eq("id", job.id);
          processedCount++;
          results.push({ id: job.id, status: "skipped" });
          continue;
        }

        // Call analyze-message function
        const response = await fetch(`${supabaseUrl}/functions/v1/analyze-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            account_id: job.account_id,
            client_id: job.client_id,
            message_content: content,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`analyze-message failed: ${response.status} - ${errorText}`);
        }

        // Mark as completed
        await supabase
          .from("ai_analysis_queue")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        processedCount++;
        results.push({ id: job.id, status: "completed" });
        console.log(`Job ${job.id} completed successfully`);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Job ${job.id} failed:`, errorMessage);

        // Check if we should retry or mark as failed
        const newAttempts = job.attempts + 1;
        const maxAttempts = 3;

        if (newAttempts >= maxAttempts) {
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
          // Reset to pending for retry
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
    console.log(`Queue processing complete. Processed: ${processedCount}, Failed: ${failedCount}, Time: ${totalTime}ms`);

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
