import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UAZAPI_URL = Deno.env.get("UAZAPI_URL") || "https://g1.uazapi.com";

interface LifeEventImage {
  id: string;
  image_url: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { life_event_id, test_phone } = await req.json();

    if (!life_event_id) {
      return new Response(
        JSON.stringify({ success: false, error: "life_event_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!test_phone) {
      return new Response(
        JSON.stringify({ success: false, error: "test_phone é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Testing CX moment ${life_event_id} to phone ${test_phone}`);

    // 1. Fetch the CX moment with client data
    const { data: moment, error: momentError } = await supabase
      .from("client_life_events")
      .select(`
        id,
        account_id,
        client_id,
        title,
        message,
        event_type,
        clients!inner (
          full_name,
          phone_e164
        )
      `)
      .eq("id", life_event_id)
      .single();

    if (momentError || !moment) {
      console.error("Error fetching moment:", momentError);
      return new Response(
        JSON.stringify({ success: false, error: "Momento CX não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch attached images
    const { data: images } = await supabase
      .from("client_life_event_images")
      .select("id, image_url")
      .eq("life_event_id", life_event_id);

    console.log(`Found ${images?.length || 0} images attached`);

    // 3. Find WhatsApp integration (try sector "operacoes" first, then fallback)
    interface Integration {
      id: string;
      config: Record<string, string>;
      sector_id: string;
    }
    
    let integration: Integration | null = null;

    const { data: operacoesIntegration } = await supabase
      .from("integrations")
      .select("id, config, sector_id")
      .eq("account_id", moment.account_id)
      .eq("type", "whatsapp")
      .eq("status", "connected")
      .eq("sector_id", "operacoes")
      .limit(1);

    if (operacoesIntegration && operacoesIntegration.length > 0) {
      integration = operacoesIntegration[0] as unknown as Integration;
    } else {
      // Fallback to any active integration
      const { data: fallbackIntegration } = await supabase
        .from("integrations")
        .select("id, config, sector_id")
        .eq("account_id", moment.account_id)
        .eq("type", "whatsapp")
        .eq("status", "connected")
        .limit(1);

      if (fallbackIntegration && fallbackIntegration.length > 0) {
        integration = fallbackIntegration[0] as unknown as Integration;
      }
    }

    if (!integration) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhuma integração WhatsApp conectada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract config from JSONB
    const config = integration.config;
    const provider = config?.provider || "uazapi";
    const instanceToken = config?.instance_token;

    if (!instanceToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Token da integração não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Using integration ${integration.id} (sector: ${integration.sector_id}, provider: ${provider})`);

    // 4. Personalize message
    // deno-lint-ignore no-explicit-any
    const clientData = (moment as any).clients;
    const client = Array.isArray(clientData) ? clientData[0] : clientData;
    const nameParts = client.full_name.trim().split(/\s+/);
    const primeiroNome = nameParts[0] || client.full_name;
    const sobrenome = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

    const personalizedMessage = (moment.message || "")
      .replace(/\{nome\}/gi, client.full_name)
      .replace(/\{primeiro_nome\}/gi, primeiroNome)
      .replace(/\{sobrenome\}/gi, sobrenome)
      .replace(/\{momento_titulo\}/gi, moment.title)
      .replace(/\{momento_tipo\}/gi, moment.event_type);

    const cleanPhone = test_phone.replace(/\D/g, "");
    console.log(`Sending to phone: ${cleanPhone}`);

    let messageSent = false;
    let imagesSent = 0;
    let sendError: string | null = null;

    // 5. Send text message first
    if (personalizedMessage.trim()) {
      try {
        if (provider === "uazapi") {
          const apiUrl = `${UAZAPI_URL}/send/text`;
          console.log(`Sending text to ${apiUrl}`);
          
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "token": instanceToken,
            },
            body: JSON.stringify({
              number: cleanPhone,
              text: personalizedMessage,
            }),
          });

          const result = await response.json();
          console.log("UAZAPI text response:", result);

          if (result.error === false || result.chatid || result.messageid || result.messageId || result.status?.toLowerCase() === "pending") {
            messageSent = true;
          } else {
            sendError = result.message || result.error || "Erro ao enviar mensagem";
          }
        } else {
          sendError = `Provider ${provider} não suportado para testes`;
        }
      } catch (error) {
        console.error("Error sending text:", error);
        sendError = (error as Error).message;
      }
    } else {
      sendError = "Mensagem está vazia";
    }

    // 6. Send images if message was sent successfully
    if (messageSent && images && images.length > 0) {
      for (const image of images as LifeEventImage[]) {
        try {
          // Small delay between images
          await new Promise(resolve => setTimeout(resolve, 2000));

          if (provider === "uazapi") {
            const apiUrl = `${UAZAPI_URL}/send/media`;
            console.log(`Sending image to ${apiUrl}: ${image.image_url}`);
            
            const response = await fetch(apiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "token": instanceToken,
              },
              body: JSON.stringify({
                number: cleanPhone,
                type: "image",
                file: image.image_url,
                text: "",
              }),
            });

            const result = await response.json();
            console.log("UAZAPI image response:", result);

            if (result.error === false || result.chatid || result.messageid || result.messageId || result.status?.toLowerCase() === "pending") {
              imagesSent++;
            }
          }
        } catch (error) {
          console.error("Error sending image:", error);
        }
      }
    }

    // 7. Return result (DO NOT update moment status - this is just a test)
    if (messageSent) {
      const totalImages = images?.length || 0;
      let successMessage = "Teste enviado com sucesso!";
      if (totalImages > 0) {
        successMessage = `Teste enviado: texto + ${imagesSent}/${totalImages} imagens`;
      }

      console.log(successMessage);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: successMessage,
          details: {
            text_sent: true,
            images_sent: imagesSent,
            total_images: totalImages,
            phone: cleanPhone,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      console.error("Failed to send test:", sendError);
      return new Response(
        JSON.stringify({ success: false, error: sendError || "Falha no envio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Error in test-cx-moment-send:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
