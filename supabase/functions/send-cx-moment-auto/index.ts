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

    // SAFETY NET: self-heal pending events whose event_date is TODAY (MM-DD match)
    // and don't have a scheduled_send_at. This prevents silent losses when an event
    // is created without proper scheduling (legacy data, race conditions, etc.).
    // Excludes manually paused events.
    const todayMMDD = new Date().toISOString().slice(5, 10); // "MM-DD"
    const { error: healError } = await supabase.rpc("heal_pending_life_events_for_today", {
      p_today_mmdd: todayMMDD,
    });
    if (healError) {
      console.warn("[heal] non-fatal:", healError.message);
    }

    // Fetch scheduled moments that are due. Excludes manually paused.
    // Batch size raised to 50 to clear backlogs faster.
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
        send_error,
        clients!inner (
          full_name,
          phone_e164
        )
      `)
      .eq("send_status", "scheduled")
      .lte("scheduled_send_at", new Date().toISOString())
      .limit(50);

    if (fetchError) {
      console.error("Error fetching moments:", fetchError);
      throw fetchError;
    }

    // Filter out manually paused (extra defense; heal RPC already skips them)
    const eligible = (moments || []).filter(
      (m) => !((m as { send_error?: string }).send_error || "").includes("PAUSADO MANUALMENTE")
    );

    if (eligible.length === 0) {
      console.log("No scheduled moments to process");
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No moments to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${eligible.length} moments to process`);

    let sentCount = 0;
    let failedCount = 0;

    for (const moment of eligible as unknown as LifeEventWithDetails[]) {
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

        // Find WhatsApp integration: prefer uazapi-with-token in "operacoes" sector,
        // then any uazapi-with-token connected. Meta_official is not yet supported here.
        let whatsappIntegration: { id: string; sector_id: string | null; config: Record<string, string> } | null = null;

        const { data: allIntegrations } = await supabase
          .from("integrations")
          .select("id, sector_id, config")
          .eq("account_id", moment.account_id)
          .eq("type", "whatsapp")
          .eq("status", "connected");

        const usableUazapi = (allIntegrations || []).filter((i) => {
          const cfg = (i.config || {}) as Record<string, string>;
          const prov = cfg.provider || "uazapi";
          return prov === "uazapi" && !!cfg.instance_token;
        });

        whatsappIntegration =
          (usableUazapi.find((i) => i.sector_id === "operacoes") as typeof whatsappIntegration) ||
          (usableUazapi[0] as typeof whatsappIntegration) ||
          null;

        if (!whatsappIntegration) {
          console.log(`No usable WhatsApp (uazapi) integration for account ${moment.account_id}`);
          await supabase
            .from("client_life_events")
            .update({
              send_status: "failed",
              send_error: "Nenhum WhatsApp UAZAPI conectado para envio automático",
            })
            .eq("id", moment.id);
          failedCount++;
          continue;
        }

        const provider = whatsappIntegration.config?.provider || "uazapi";
        const instanceToken = whatsappIntegration.config?.instance_token;
        const UAZAPI_URL =
          whatsappIntegration.config?.host_url ||
          Deno.env.get("UAZAPI_URL") ||
          "https://g1.uazapi.com";
        console.log(`[cx-auto] Using integration ${whatsappIntegration.id} via ${UAZAPI_URL}`);

        if (!instanceToken) {
          await supabase
            .from("client_life_events")
            .update({
              send_status: "failed",
              send_error: "Token da integração WhatsApp não configurado",
            })
            .eq("id", moment.id);
          failedCount++;
          continue;
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
        if (personalizedMessage.trim() && provider === "uazapi") {
          try {
            const response = await fetch(`${UAZAPI_URL}/send/text`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "token": instanceToken },
              body: JSON.stringify({ number: phoneClean, text: personalizedMessage }),
            });
            const result = await response.json();
            console.log("UAZAPI text response:", result);
            if (result.error === false || result.chatid || result.messageid || result.messageId || result.status?.toLowerCase?.() === "pending") {
              messageSent = true;
            } else {
              sendError = result.message || result.error || "Erro ao enviar mensagem";
            }
          } catch (error) {
            console.error("Error sending text:", error);
            sendError = (error as Error).message;
          }
        } else if (!personalizedMessage.trim()) {
          sendError = "Mensagem está vazia";
        } else {
          sendError = `Provider ${provider} não suportado`;
        }

        // Send images if message was sent successfully
        if (messageSent && images && images.length > 0 && provider === "uazapi") {
          for (const image of images as LifeEventImage[]) {
            try {
              await randomDelay(2, 4);
              const response = await fetch(`${UAZAPI_URL}/send/media`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "token": instanceToken },
                body: JSON.stringify({ number: phoneClean, type: "image", file: image.image_url, text: "" }),
              });
              const result = await response.json();
              console.log("UAZAPI image response:", result);
              if (result.error === false || result.chatid || result.messageid || result.messageId || result.status?.toLowerCase?.() === "pending") {
                imagesSent++;
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
