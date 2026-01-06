import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      accountId,
      sectorId,
      userId,
      conversationId,
      suggestionType,
      originalText,
      suggestedText,
      contextMessages,
      feedback,
      wasUsed,
      editedBeforeSend,
      finalTextSent,
    } = await req.json();

    if (!accountId || !sectorId || !userId || !suggestedText || !feedback) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("ai_suggestion_feedback")
      .insert({
        account_id: accountId,
        sector_id: sectorId,
        user_id: userId,
        conversation_id: conversationId || null,
        suggestion_type: suggestionType || "reply",
        original_text: originalText || null,
        suggested_text: suggestedText,
        context_messages: contextMessages || null,
        feedback,
        was_used: wasUsed || false,
        edited_before_send: editedBeforeSend || null,
        final_text_sent: finalTextSent || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving feedback:", error);
      throw error;
    }

    console.log("Feedback saved:", data.id, feedback, sectorId);

    return new Response(
      JSON.stringify({ success: true, feedbackId: data.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in save-suggestion-feedback:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
