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

// deno-lint-ignore no-explicit-any
type SB = any;

function extractExternalId(result: Record<string, unknown>): string | null {
  const v = (result?.id || result?.messageid || result?.messageId) as string | undefined;
  return v ? String(v) : null;
}

// Every automatic send MUST be mirrored in RoyZapp, otherwise the team loses context.
async function findOrCreateConversation(
  supabase: SB,
  p: { accountId: string; clientId: string; phoneE164: string; name: string; sectorId: string | null; integrationId: string },
): Promise<string | null> {
  let q = supabase
    .from("zapp_conversations")
    .select("id")
    .eq("account_id", p.accountId)
    .eq("phone_e164", p.phoneE164)
    .eq("is_group", false);
  q = p.sectorId ? q.eq("sector_id", p.sectorId) : q.is("sector_id", null);
  const { data: existing } = await q.order("last_message_at", { ascending: false }).limit(1);
  if (existing && existing[0]) return existing[0].id;

  const { data: created, error } = await supabase
    .from("zapp_conversations")
    .insert({
      account_id: p.accountId,
      client_id: p.clientId,
      phone_e164: p.phoneE164,
      contact_name: p.name,
      sector_id: p.sectorId,
      integration_id: p.integrationId,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[cx-auto] create conversation failed:", error.message);
    return null;
  }
  return created.id;
}

async function mirrorToRoyZapp(
  supabase: SB,
  p: {
    accountId: string;
    conversationId: string;
    messageType: "text" | "image";
    content: string;
    mediaUrl?: string;
    externalId: string | null;
  },
) {
  if (p.externalId) {
    const { data: dup } = await supabase
      .from("zapp_messages")
      .select("id")
      .eq("account_id", p.accountId)
      .eq("external_message_id", p.externalId)
      .limit(1);
    if (dup && dup.length) return;
  }
  const now = new Date().toISOString();
  const { error } = await supabase.from("zapp_messages").insert({
    account_id: p.accountId,
    zapp_conversation_id: p.conversationId,
    direction: "outbound",
    content: p.content,
    message_type: p.messageType,
    media_url: p.mediaUrl ?? null,
    media_type: p.messageType === "image" ? "image" : null,
    external_message_id: p.externalId,
    delivery_status: "sent",
    sender_name: "Automação CX",
    sent_at: now,
  });
  if (error) {
    console.error("[cx-auto] mirror message failed:", error.message);
    return;
  }
  await supabase
    .from("zapp_conversations")
    .update({
      last_message_at: now,
      last_message_preview: p.messageType === "image" ? "📷 Imagem" : p.content.slice(0, 120),
      updated_at: now,
    })
    .eq("id", p.conversationId);
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
    const notPaused = (moments || []).filter(
      (m) => !((m as { send_error?: string }).send_error || "").includes("PAUSADO MANUALMENTE")
    );

    // NO RETROACTIVE SENDS: never fire messages for moments that were due before the
    // cutoff (go-live) or that are older than the backlog window. They are archived
    // as "skipped" so the queue stays clean and nobody receives a late message.
    const cutoffIso = Deno.env.get("CX_NO_SEND_BEFORE") || "2026-08-07T19:40:00Z";
    const cutoffMs = new Date(cutoffIso).getTime();
    const backlogMs = Date.now() - 12 * 60 * 60 * 1000; // max 12h of backlog
    const minDueMs = Math.max(cutoffMs, backlogMs);

    const eligible: typeof notPaused = [];
    const stale: string[] = [];
    for (const m of notPaused) {
      const dueMs = new Date((m as { scheduled_send_at: string }).scheduled_send_at).getTime();
      if (!Number.isFinite(dueMs) || dueMs < minDueMs) {
        stale.push((m as { id: string }).id);
      } else {
        eligible.push(m);
      }
    }

    if (stale.length > 0) {
      console.log(`[cx-auto] Skipping ${stale.length} retroactive moments (due before ${new Date(minDueMs).toISOString()})`);
      await supabase
        .from("client_life_events")
        .update({
          send_status: "cancelled",
          send_error: "Envio retroativo bloqueado (fora da janela de envio)",
        })
        .in("id", stale);
    }

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

        // Prefer integrations that declare their own host_url (multi-host servers);
        // falling back to the global default host caused "host not mapped" failures.
        const withHost = usableUazapi.filter((i) => !!(i.config || {}).host_url);
        const pool = withHost.length > 0 ? withHost : usableUazapi;

        whatsappIntegration =
          (pool.find((i) => i.sector_id === "operacoes") as typeof whatsappIntegration) ||
          (pool[0] as typeof whatsappIntegration) ||
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

        // Fallback template when the moment has no message saved (legacy records)
        const fallbackMessage =
          moment.event_type === "birthday"
            ? `Feliz aniversário, {primeiro_nome}! 🎉\n\nQue este novo ciclo venha cheio de saúde, conquistas e realizações. Estamos muito felizes em ter você com a gente. Conte sempre conosco!`
            : "";

        // Placeholders ("-", ".", "^^") were typed only to bypass the old required field.
        // Never send them as text: skip if an official duplicate exists, else use fallback.
        const savedMessage = (moment.message || "").trim();
        const isPlaceholder = savedMessage.replace(/[\s\-.^_*~]/g, "").length < 3;
        if (isPlaceholder) {
          const { data: siblings } = await supabase
            .from("client_life_events")
            .select("id, message")
            .eq("client_id", moment.client_id)
            .eq("event_type", moment.event_type)
            .neq("id", moment.id)
            .neq("send_status", "cancelled");
          const hasOfficial = (siblings || []).some(
            (s: { message: string | null }) => (s.message || "").trim().length > 10,
          );
          if (hasOfficial) {
            await supabase
              .from("client_life_events")
              .update({
                send_status: "cancelled",
                scheduled_send_at: null,
                send_error: "PAUSADO MANUALMENTE: registro duplicado com mensagem vazia (-)",
              })
              .eq("id", moment.id);
            continue;
          }
        }
        const rawMessage = (isPlaceholder ? "" : savedMessage) || fallbackMessage;
        if (!rawMessage) {
          await supabase
            .from("client_life_events")
            .update({ send_status: "failed", send_error: "Mensagem está vazia" })
            .eq("id", moment.id);
          failedCount++;
          continue;
        }

        const personalizedMessage = rawMessage
          .replace(/\{nome\}/gi, client.full_name)
          .replace(/\{primeiro_nome\}/gi, primeiroNome)
          .replace(/\{sobrenome\}/gi, sobrenome)
          .replace(/\{momento_titulo\}/gi, moment.title)
          .replace(/\{momento_tipo\}/gi, moment.event_type);

        const phoneClean = client.phone_e164.replace(/\D/g, "");

        let messageSent = false;
        let imagesSent = 0;
        let sendError: string | null = null;
        let zappConvId: string | null = null;

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
              zappConvId = await findOrCreateConversation(supabase, {
                accountId: moment.account_id,
                clientId: moment.client_id,
                phoneE164: client.phone_e164,
                name: client.full_name,
                sectorId: whatsappIntegration.sector_id,
                integrationId: whatsappIntegration.id,
              });
              if (zappConvId) {
                await mirrorToRoyZapp(supabase, {
                  accountId: moment.account_id,
                  conversationId: zappConvId,
                  messageType: "text",
                  content: personalizedMessage,
                  externalId: extractExternalId(result),
                });
              }
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
              if (zappConvId && (result.error === false || result.messageid || result.messageId || result.id)) {
                await mirrorToRoyZapp(supabase, {
                  accountId: moment.account_id,
                  conversationId: zappConvId,
                  messageType: "image",
                  content: "",
                  mediaUrl: image.image_url,
                  externalId: extractExternalId(result),
                });
              }
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
        processed: eligible.length,
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
