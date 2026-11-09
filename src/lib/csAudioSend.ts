import { supabase } from "@/integrations/supabase/client";
import { invokeWhatsAppManager } from "@/lib/whatsappRouting";
import { withZappRetry } from "@/lib/zappTransientErrors";

/**
 * Envia um áudio gravado nos Processos como nota de voz (PTT) na conversa
 * 1:1 da cliente no RoyZapp — chega como "gravado agora", nunca como arquivo
 * ou encaminhado. Usa a mesma rota de envio do chat (RLS e setor da conversa).
 */
export async function sendProcessAudio(opts: {
  blob: Blob; duration: number; clientId: string; clientPhone?: string | null;
  user: { id: string; account_id: string; name?: string | null };
}) {
  const { blob, duration, clientId, clientPhone, user } = opts;
  if (blob.size < 2048) throw new Error("O áudio ficou vazio. Grave novamente verificando o microfone.");

  const sel = "id, phone_e164, integration_id, sector_id";
  let { data: conv } = await supabase.from("zapp_conversations").select(sel)
    .eq("client_id", clientId).eq("is_group", false)
    .order("last_message_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  if (!conv && clientPhone) {
    ({ data: conv } = await supabase.from("zapp_conversations").select(sel)
      .eq("phone_e164", clientPhone).eq("is_group", false)
      .order("last_message_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle());
  }
  if (!conv) throw new Error("Não encontramos a conversa desta cliente no RoyZapp. Abra o WhatsApp dela no RoyZapp primeiro.");
  const phone = conv.phone_e164 || clientPhone;
  if (!phone) throw new Error("A cliente não tem telefone cadastrado.");

  const ext = blob.type.includes("ogg") ? "ogg" : "webm";
  const stamp = Date.now();
  const fileName = `${user.account_id}/audio_${stamp}.${ext}`;
  await withZappRetry(async () => {
    const { error } = await supabase.storage.from("zapp-media").upload(fileName, blob, { cacheControl: "3600", upsert: false, contentType: blob.type });
    if (error && !/already exists|duplicate/i.test(error.message || "")) throw error;
  });
  const mediaUrl = supabase.storage.from("zapp-media").getPublicUrl(fileName).data.publicUrl;
  const now = new Date().toISOString();

  const { data: msg, error: insErr } = await supabase.from("zapp_messages").insert({
    account_id: user.account_id, zapp_conversation_id: conv.id, direction: "outbound", content: "",
    message_type: "audio", media_url: mediaUrl, media_type: "audio", media_mimetype: blob.type,
    media_filename: `audio_${stamp}.${ext}`, audio_duration_sec: duration, media_download_status: "completed",
    sent_at: now, sender_user_id: user.id, sender_name: user.name || null,
  }).select("id").single();
  if (insErr) throw insErr;

  const { data, error } = await invokeWhatsAppManager(conv.integration_id || undefined, {
    action: "send_media", phone, media_url: mediaUrl, media_type: "ptt", caption: "",
    file_name: `audio_${stamp}.${ext}`, sector_id: conv.sector_id || "", integration_id: conv.integration_id || "",
    add_signature: false,
  });
  const inner = (data?.data || data) as Record<string, any> | null;
  const externalId = inner?.id || inner?.messageid || null;
  if (error || !externalId) {
    await supabase.from("zapp_messages").update({ media_download_status: "failed" }).eq("id", msg.id);
    throw new Error(inner?.message || "O WhatsApp não confirmou o envio do áudio. Tente novamente.");
  }
  await supabase.from("zapp_messages").update({ external_message_id: externalId }).eq("id", msg.id);
  await supabase.from("zapp_conversations").update({ last_message_at: now, last_message_preview: "🎤 Áudio" }).eq("id", conv.id);
}
