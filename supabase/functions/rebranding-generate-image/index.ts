// Gera imagens usando Lovable AI (Gemini 3 Pro Image / Nano Banana 2)
// Recebe: prompt, aspectRatio, palette[], referenceUrls[], channelKey, assetLabel
// Retorna: { dataUrl, generationId }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AR_TO_SIZE: Record<string, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
  "16:9": { w: 1920, h: 1080 },
  "3:2": { w: 1200, h: 800 },
  "2:3": { w: 800, h: 1200 },
  "4:3": { w: 1200, h: 900 },
  "3:4": { w: 900, h: 1200 },
  "21:9": { w: 1920, h: 820 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: profile } = await admin
      .from("users")
      .select("account_id, name")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!profile?.account_id) throw new Error("Conta do usuário não encontrada");

    const body = await req.json();
    const {
      prompt,
      aspectRatio = "1:1",
      palette = [],
      predominantHex = null,
      referenceUrls = [],
      channelKey = null,
      assetLabel = null,
      styleNotes = "",
      model = "google/gemini-3-pro-image-preview",
    } = body || {};

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Prompt muito curto (mínimo 5 caracteres)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (prompt.length > 4000) {
      return new Response(JSON.stringify({ error: "Prompt excede 4000 caracteres" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const size = AR_TO_SIZE[aspectRatio] || AR_TO_SIZE["1:1"];

    // Monta prompt enriquecido com brand kit
    const predominant = predominantHex || (palette[0] ?? null);
    const supportColors = (palette as string[]).filter((c) => c !== predominant);
    const paletteText = palette.length
      ? `Paleta obrigatória da marca: ${predominant ? `cor PREDOMINANTE ${predominant} (deve ocupar a maior área visual)` : ""}${supportColors.length ? `, cores de apoio: ${supportColors.join(", ")}` : ""}. Use somente estas cores.`
      : "";
    const styleText = styleNotes ? `Estilo: ${styleNotes}.` : "";
    const dimensionText = `Dimensões alvo: ${size.w}×${size.h}px (aspect ratio ${aspectRatio}).`;
    const brandPreface = `Esta imagem é para a marca Eternum. Mantenha consistência com a identidade visual. ${paletteText} ${styleText} ${dimensionText}`.trim();

    const isOpenAIImage = typeof model === "string" && model.startsWith("openai/gpt-image");
    let dataUrl: string | null = null;

    if (isOpenAIImage) {
      // OpenAI /v1/images/generations — não suporta referenceUrls nem messages
      // Mapeia aspect ratio para os tamanhos aceitos
      const openaiSize =
        aspectRatio === "16:9" || aspectRatio === "3:2" || aspectRatio === "4:3" || aspectRatio === "21:9"
          ? "1536x1024"
          : aspectRatio === "9:16" || aspectRatio === "2:3" || aspectRatio === "3:4" || aspectRatio === "4:5"
          ? "1024x1536"
          : "1024x1024";

      const fullPrompt = `${brandPreface}\n\n${prompt}`;
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt: fullPrompt,
          size: openaiSize,
          quality: "high",
          n: 1,
        }),
      });

      if (!aiResp.ok) {
        const txt = await aiResp.text();
        if (aiResp.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições atingido. Aguarde alguns segundos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResp.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Settings > Workspace > Usage." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error("AI gateway error:", aiResp.status, txt);
        throw new Error(`AI Gateway erro ${aiResp.status}`);
      }
      const aiJson = await aiResp.json();
      const b64 = aiJson?.data?.[0]?.b64_json;
      if (b64) dataUrl = `data:image/png;base64,${b64}`;
    } else {
      // Gemini via chat completions (suporta referenceUrls multimodais)
      const content: any[] = [{ type: "text", text: `${brandPreface}\n\n${prompt}` }];
      for (const url of (referenceUrls as string[]).slice(0, 4)) {
        content.push({ type: "image_url", image_url: { url } });
      }

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content }],
          modalities: ["image", "text"],
        }),
      });

      if (!aiResp.ok) {
        const txt = await aiResp.text();
        if (aiResp.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições atingido. Aguarde alguns segundos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResp.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Settings > Workspace > Usage." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error("AI gateway error:", aiResp.status, txt);
        throw new Error(`AI Gateway erro ${aiResp.status}`);
      }

      const aiJson = await aiResp.json();
      const msg = aiJson.choices?.[0]?.message;
      if (Array.isArray(msg?.images) && msg.images[0]?.image_url?.url) {
        dataUrl = msg.images[0].image_url.url;
      }
      if (!dataUrl && Array.isArray(msg?.content)) {
        for (const part of msg.content) {
          if (part?.type === "image_url" && part?.image_url?.url) {
            dataUrl = part.image_url.url;
            break;
          }
        }
      }
    }

    if (!dataUrl) {
      throw new Error("IA não retornou imagem");
    }

    // Persiste registro
    const { data: gen } = await admin
      .from("rebranding_ai_generations")
      .insert({
        account_id: profile.account_id,
        user_id: user.id,
        user_name: profile.name,
        channel_key: channelKey,
        asset_label: assetLabel,
        prompt,
        model,
        aspect_ratio: aspectRatio,
        width: size.w,
        height: size.h,
        palette,
        reference_files: referenceUrls,
        status: "success",
      })
      .select("id")
      .single();

    return new Response(
      JSON.stringify({ dataUrl, generationId: gen?.id, width: size.w, height: size.h }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("rebranding-generate-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
