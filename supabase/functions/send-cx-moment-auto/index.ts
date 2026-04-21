import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LifeEventWithDetails {
  id: string;
  account_id: string;
  client_id: string;
  title: string;
  message: string | null;
  event_date: string | null;
  event_type: string;
  is_recurring: boolean;
  scheduled_send_at: string;
  send_status: string;
  clients: {
    full_name: string;
    phone_e164: string | null;
  };
}

interface LifeEventImage {
  id: string;
  image_url: string;
}

// Random delay between min and max seconds
function randomDelay(minSeconds: number, maxSeconds: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) * 1000;
  return new Promise(resolve => setTimeout(resolve, delay));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log("Processing scheduled CX moments...");

    // Fetch scheduled moments that are due (limit to 10 per execution)
    const { data: moments, error: fetchError } = await supabase
      .from("client_life_events")
      .select(`
        id,
        account_id,
        client_id,
        title,
        message,
        event_date,
        event_type,
        is_recurring,
        scheduled_send_at,
        send_status,
        clients!inner (
          full_name,
          phone_e164
        )
      `)
      .eq("send_status", "scheduled")
      .lte("scheduled_send_at", new Date().toISOString())
      .limit(10);

    if (fetchError) {
      console.error("Error fetching moments:", fetchError);
      throw fetchError;
    }

    if (!moments || moments.length === 0) {
      console.log("No scheduled moments to process");
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No moments to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${moments.length} moments to process`);

    let sentCount = 0;
    let failedCount = 0;

    for (const moment of moments as unknown as LifeEventWithDetails[]) {
      try {
        const client = moment.clients;
        
        if (!client?.phone_e164) {
          console.log(`Client ${moment.client_id} has no phone number, marking as failed`);
          await supabase
            .from("client_life_events")
            .update({
              send_status: "failed",
              send_error: "Cliente sem telefone cadastrado",
            })
            .eq("id", moment.id);
          failedCount++;
          continue;
        }

        // Find WhatsApp integration for "Operação" sector
        const { data: integrations, error: integrationError } = await supabase
          .from("whatsapp_integrations")
          .select("*")
          .eq("account_id", moment.account_id)
          .eq("is_active", true)
          .eq("sector_id", "operacoes")
          .limit(1);

        let whatsappIntegration = integrations?.[0];

        if (integrationError || !whatsappIntegration) {
          console.log(`No WhatsApp integration found for account ${moment.account_id}`);
          
          // Try to find any active integration as fallback
          const { data: fallbackIntegration } = await supabase
            .from("whatsapp_integrations")
            .select("*")
            .eq("account_id", moment.account_id)
            .eq("is_active", true)
            .limit(1);

          if (!fallbackIntegration || fallbackIntegration.length === 0) {
            await supabase
              .from("client_life_events")
              .update({
                send_status: "failed",
                send_error: "Nenhum WhatsApp conectado para envio automático",
              })
              .eq("id", moment.id);
            failedCount++;
            continue;
          }
          
          // Use fallback integration
          whatsappIntegration = fallbackIntegration[0];
        }

        // Get attached images
        const { data: images } = await supabase
          .from("client_life_event_images")
          .select("id, image_url")
          .eq("life_event_id", moment.id);

        // Personalize message
        const nameParts = client.full_name.trim().split(/\s+/);
        const primeiroNome = nameParts[0] || client.full_name;
        const sobrenome = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

        const personalizedMessage = (moment.message || "")
          .replace(/\{nome\}/gi, client.full_name)
          .replace(/\{primeiro_nome\}/gi, primeiroNome)
          .replace(/\{sobrenome\}/gi, sobrenome)
          .replace(/\{momento_titulo\}/gi, moment.title)
          .replace(/\{momento_tipo\}/gi, moment.event_type);

        const phoneClean = client.phone_e164.replace(/\D/g, "");

        let messageSent = false;
        let imagesSent = 0;
        let sendError: string | null = null;

        // Send text message first
        if (personalizedMessage.trim()) {
          try {
            if (whatsappIntegration.provider === "uazapi") {
              const apiUrl = `${whatsappIntegration.api_url}/sendText`;
              const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${whatsappIntegration.api_key}`,
                },
                body: JSON.stringify({
                  phone: phoneClean,
                  message: personalizedMessage,
                }),
              });

              const result = await response.json();
              console.log("UAZAPI text response:", result);

              if (result.error === false || result.status === "PENDING" || result.messageId) {
                messageSent = true;
              } else {
                sendError = result.message || result.error || "Erro ao enviar mensagem";
              }
            } else if (whatsappIntegration.provider === "evolution") {
              const baseUrl = whatsappIntegration.api_url?.endsWith("/") 
                ? whatsappIntegration.api_url.slice(0, -1) 
                : whatsappIntegration.api_url;
              const apiUrl = `${baseUrl}/message/sendText/${whatsappIntegration.instance_name}`;
              
              const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": whatsappIntegration.api_key || "",
                },
                body: JSON.stringify({
                  number: phoneClean,
                  text: personalizedMessage,
                }),
              });

              const result = await response.json();
              console.log("Evolution text response:", result);

              if (result.key?.id || result.status === "PENDING") {
                messageSent = true;
              } else {
                sendError = result.message || result.error || "Erro ao enviar mensagem";
              }
            }
          } catch (error) {
            console.error("Error sending text:", error);
            sendError = (error as Error).message;
          }
        }

        // Send images if message was sent successfully
        if (messageSent && images && images.length > 0) {
          for (const image of images as LifeEventImage[]) {
            try {
              await randomDelay(2, 4); // Small delay between images

              if (whatsappIntegration.provider === "uazapi") {
                const apiUrl = `${whatsappIntegration.api_url}/sendMedia`;
                const response = await fetch(apiUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${whatsappIntegration.api_key}`,
                  },
                  body: JSON.stringify({
                    phone: phoneClean,
                    type: "image",
                    media: image.image_url,
                    caption: "", // No caption for images
                  }),
                });

                const result = await response.json();
                console.log("UAZAPI image response:", result);

                if (result.error === false || result.status === "PENDING" || result.messageId) {
                  imagesSent++;
                }
              } else if (whatsappIntegration.provider === "evolution") {
                const baseUrl = whatsappIntegration.api_url?.endsWith("/") 
                  ? whatsappIntegration.api_url.slice(0, -1) 
                  : whatsappIntegration.api_url;
                const apiUrl = `${baseUrl}/message/sendMedia/${whatsappIntegration.instance_name}`;
                
                const response = await fetch(apiUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "apikey": whatsappIntegration.api_key || "",
                  },
                  body: JSON.stringify({
                    number: phoneClean,
                    mediatype: "image",
                    media: image.image_url,
                    caption: "",
                  }),
                });

                const result = await response.json();
                console.log("Evolution image response:", result);

                if (result.key?.id || result.status === "PENDING") {
                  imagesSent++;
                }
              }
            } catch (error) {
              console.error("Error sending image:", error);
            }
          }
        }

        // Update moment status
        if (messageSent) {
          const updateData: Record<string, unknown> = {
            send_status: "sent",
            sent_at: new Date().toISOString(),
            integration_id: whatsappIntegration.id,
            send_error: images && images.length > imagesSent 
              ? `Enviado com ${imagesSent}/${images.length} imagens` 
              : null,
          };

          // If recurring, schedule next occurrence
          if (moment.is_recurring && moment.scheduled_send_at) {
            const nextYear = new Date(moment.scheduled_send_at);
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            updateData.scheduled_send_at = nextYear.toISOString();
            updateData.send_status = "scheduled";
            updateData.sent_at = new Date().toISOString(); // Keep track of last sent
          }

          await supabase
            .from("client_life_events")
            .update(updateData)
            .eq("id", moment.id);

          sentCount++;
          console.log(`Successfully sent to ${client.full_name}`);
        } else {
          await supabase
            .from("client_life_events")
            .update({
              send_status: "failed",
              send_error: sendError || "Falha no envio",
            })
            .eq("id", moment.id);
          failedCount++;
          console.log(`Failed to send to ${client.full_name}: ${sendError}`);
        }

        // Random delay between recipients (3-10 seconds)
        await randomDelay(3, 10);

      } catch (error) {
        console.error(`Error processing moment ${moment.id}:`, error);
        await supabase
          .from("client_life_events")
          .update({
            send_status: "failed",
            send_error: (error as Error).message,
          })
          .eq("id", moment.id);
        failedCount++;
      }
    }

    console.log(`Processing complete: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: moments.length,
        sent: sentCount,
        failed: failedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-cx-moment-auto:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
