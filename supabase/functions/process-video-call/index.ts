const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id } = await req.json();
    if (!session_id) throw new Error("session_id is required");

    console.log(`[process-video-call] Processing session: ${session_id}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get session data
    const { data: session, error: fetchError } = await supabase
      .from("video_call_sessions")
      .select("*")
      .eq("id", session_id)
      .single();

    if (fetchError || !session) {
      throw new Error("Session not found");
    }

    if (!session.recording_url) {
      console.log("[process-video-call] No recording URL, skipping");
      return new Response(
        JSON.stringify({ status: "no_recording" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Download audio from recording (supports both external URLs and storage paths)
    console.log("[process-video-call] Downloading recording from:", session.recording_url);
    let audioBlob: Blob;

    // Check if it's a Supabase storage URL
    if (session.recording_url.includes("/storage/v1/object/public/call-recordings/")) {
      // Download from storage using service role
      const storagePath = session.recording_url.split("/call-recordings/")[1];
      const { data: storageData, error: storageError } = await supabase.storage
        .from("call-recordings")
        .download(storagePath);

      if (storageError || !storageData) {
        throw new Error(`Failed to download from storage: ${storageError?.message}`);
      }
      audioBlob = storageData;
    } else {
      // External URL (Daily.co recording etc)
      const audioResponse = await fetch(session.recording_url);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download recording: ${audioResponse.status}`);
      }
      audioBlob = await audioResponse.blob();
    }

    console.log(`[process-video-call] Recording downloaded, size: ${audioBlob.size} bytes`);

    // Step 2: Transcribe with OpenAI Whisper
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    let transcription = "";

    if (openaiApiKey) {
      console.log("[process-video-call] Transcribing with Whisper...");
      const formData = new FormData();
      // Detect file extension from URL
      const fileExt = session.recording_url.includes(".webm") ? "audio.webm" : "recording.mp4";
      formData.append("file", audioBlob, fileExt);
      formData.append("model", "whisper-1");
      formData.append("language", "pt");

      const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiApiKey}` },
        body: formData,
      });

      if (whisperRes.ok) {
        const whisperData = await whisperRes.json();
        transcription = whisperData.text || "";
        console.log(`[process-video-call] Transcription received: ${transcription.substring(0, 100)}...`);
      } else {
        console.error("[process-video-call] Whisper error:", await whisperRes.text());
      }
    } else {
      console.warn("[process-video-call] OPENAI_API_KEY not configured, skipping transcription");
    }

    // Save transcription
    await supabase
      .from("video_call_sessions")
      .update({
        transcription,
        analysis_status: transcription ? "analyzing" : "no_transcription",
      })
      .eq("id", session_id);

    // Step 3: Analyze with AI (reuse analyze-sales-call logic)
    if (transcription && transcription.length > 50) {
      console.log("[process-video-call] Analyzing call...");
      
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const systemPrompt = `Você é um especialista em vendas e coaching comercial. Analise a transcrição de uma call de vendas e retorne uma análise COMPLETA e DETALHADA em português brasileiro.

ESTRUTURA OBRIGATÓRIA DA ANÁLISE:

## 📊 Resumo Geral
- Duração estimada da call
- Resultado (venda fechada, follow-up, perdida, etc.)
- Nota geral do vendedor (0-10)

## 🚫 Objeções Identificadas
Para CADA objeção encontrada:
- **Objeção:** O que o lead disse
- **Momento:** Em que contexto surgiu
- **Como o vendedor reagiu:** O que fez (ou não fez)
- **Rebatimento sugerido:** Como deveria ter respondido

## ❌ Erros do Vendedor
Liste TODOS os erros identificados com descrição, problema e solução.

## ✅ Pontos Fortes
O que o vendedor fez bem.

## 🎯 Diagnóstico de Perdas
- Por que a venda não avançou
- Principal gap de habilidade
- Nível de preparo (1-10)

## 📝 Script Melhorado
Reescreva as partes mais críticas como deveriam ter sido conduzidas.

## 🔑 Top 3 Ações Imediatas
Ações práticas e específicas para a próxima call.

IMPORTANTE: Seja DIRETO e ESPECÍFICO. Use exemplos reais da transcrição.`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Analise esta transcrição de call de vendas:\n\n${transcription}` },
            ],
            max_tokens: 4000,
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const analysis = aiData.choices?.[0]?.message?.content || "";

          await supabase
            .from("video_call_sessions")
            .update({ analysis, analysis_status: "completed" })
            .eq("id", session_id);

          console.log("[process-video-call] Analysis completed successfully");

          // Also save to sales_call_analyses for the Script de Vendas area
          try {
            const preview = transcription.substring(0, 200);
            await supabase.from("sales_call_analyses").insert({
              account_id: session.account_id,
              user_id: session.user_id,
              analysis: analysis,
              transcript_preview: preview || null,
            });
            console.log("[process-video-call] Saved to sales_call_analyses");
          } catch (saveErr) {
            console.error("[process-video-call] Failed to save to sales_call_analyses:", saveErr);
          }
        } else {
          console.error("[process-video-call] AI analysis error:", await aiRes.text());
          await supabase
            .from("video_call_sessions")
            .update({ analysis_status: "analysis_failed" })
            .eq("id", session_id);
        }
      }
    }

    return new Response(
      JSON.stringify({ status: "completed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[process-video-call] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
