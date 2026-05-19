import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import fixWebmDuration from "fix-webm-duration";
import { Message } from "@/hooks/useZappData";
import { ConversationAssignment, getContactInfo } from "@/components/royzapp/types";
import { invokeWhatsAppManager } from "@/lib/whatsappRouting";

interface UseZappMessagingProps {
  selectedConversation: ConversationAssignment | null;
  currentUser: { id: string; account_id: string; auth_user_id: string; name?: string | null } | null;
  selectedSectorId: string | null;
  selectedIntegrationId: string | undefined;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  fetchMessages: (conversationId: string) => void;
  userSignature: string;
  signatureEnabled: boolean;
  navigate: (path: string) => void;
  onConversationUpdated?: (conversationId: string, lastMessageAt: string, lastMessagePreview: string) => void;
}

const normalizeSignature = (signature: string) => signature.trim().replace(/:+$/, "").trim();

const buildSignatureHeader = (signature: string) => {
  const cleanSignature = normalizeSignature(signature);
  return cleanSignature ? `*${cleanSignature}:*` : "";
};

const hasSameSignatureHeader = (text: string, signature: string) => {
  const firstLine = text.trim().split(/\r?\n/, 1)[0]?.trim();
  if (!firstLine || !signature) return false;
  return firstLine === `*${signature}:*` || firstLine === `*${signature}*`;
};

export function useZappMessaging({
  selectedConversation,
  currentUser,
  selectedSectorId,
  selectedIntegrationId,
  messages,
  setMessages,
  fetchMessages,
  userSignature,
  signatureEnabled,
  navigate,
  onConversationUpdated,
}: UseZappMessagingProps) {
  // Message input state
  const [messageInput, setMessageInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioPreview, setAudioPreview] = useState<{ blob: Blob; url: string; duration: number } | null>(null);
  const [imagePreview, setImagePreview] = useState<{ file: File; url: string; caption?: string } | null>(null);
  const [filePreview, setFilePreview] = useState<{ file: File; url: string } | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [showFormatting, setShowFormatting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string | null; sender_name: string | null; is_from_client: boolean; external_message_id?: string | null } | null>(null);
  const [pendingMentions, setPendingMentions] = useState<{ phone: string; jid: string }[]>([]);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  /**
   * CRITICAL SAFETY CHECK: before invoking any WhatsApp send, confirm that the
   * integration we're about to use actually belongs to the currently selected
   * sector. This prevents a stale/cross-sector integration_id (URL, preference,
   * or conversation row) from routing a message through the WRONG WhatsApp
   * number (e.g. Operações enviando pelo número Comercial).
   *
   * Returns true if safe to send; false (and toasts the user) if not.
   */
  const assertIntegrationMatchesSector = useCallback(
    async (integrationId: string | undefined | null): Promise<boolean> => {
      if (!integrationId) {
        toast.error("WhatsApp não configurado", {
          description: "Nenhuma instância selecionada para este setor.",
        });
        return false;
      }
      if (!selectedSectorId || !currentUser?.account_id) {
        toast.error("Setor não selecionado", {
          description: "Recarregue a página e selecione o setor novamente.",
        });
        return false;
      }
      try {
        const { data, error } = await supabase
          .from("integrations")
          .select("sector_id, status")
          .eq("id", integrationId)
          .eq("account_id", currentUser.account_id)
          .maybeSingle();
        if (error || !data) {
          console.error("[ZAPP-SEND] Integration lookup failed:", error);
          toast.error("Instância do WhatsApp não encontrada", {
            description: "Recarregue a página e tente novamente.",
          });
          return false;
        }
        if (data.sector_id !== selectedSectorId) {
          console.error(
            `[ZAPP-SEND] ABORT: integration ${integrationId} belongs to sector "${data.sector_id}" but current sector is "${selectedSectorId}".`
          );
          toast.error("Setor incorreto para esta instância", {
            description:
              "A instância selecionada não pertence ao setor atual. Recarregue a página e selecione o setor novamente para evitar envio pelo número errado.",
          });
          return false;
        }
        return true;
      } catch (err) {
        console.error("[ZAPP-SEND] assertIntegrationMatchesSector error:", err);
        toast.error("Erro ao validar instância do WhatsApp");
        return false;
      }
    },
    [selectedSectorId, currentUser?.account_id]
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  // Cache de áudios que falharam pra permitir reenvio em 1 clique mantendo o mesmo conteúdo
  const failedAudiosRef = useRef<Map<string, { blob: Blob; duration?: number }>>(new Map());

  // Contact picker state
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [sendingContact, setSendingContact] = useState(false);

  const buildSignedText = useCallback((text: string) => {
    const baseText = text.trim();
    const cleanSignature = normalizeSignature(userSignature);
    if (!signatureEnabled || !cleanSignature || !baseText || hasSameSignatureHeader(baseText, cleanSignature)) {
      return baseText;
    }
    return `${buildSignatureHeader(cleanSignature)}\n${baseText}`;
  }, [signatureEnabled, userSignature]);

  // Quick replies state
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [quickReplies, setQuickReplies] = useState<{ id: string; title: string; content: string }[]>([]);
  const [quickReplyDialogOpen, setQuickReplyDialogOpen] = useState(false);
  const [editingQuickReply, setEditingQuickReply] = useState<{ id: string; title: string; content: string } | null>(null);
  const [quickReplyForm, setQuickReplyForm] = useState({ title: "", content: "" });
  const [savingQuickReply, setSavingQuickReply] = useState(false);

  // Ref to track current conversation ID for realtime validation
  const currentConversationIdRef = useRef<string | null>(null);

  // Update ref when conversation changes
  useEffect(() => {
    currentConversationIdRef.current = 
      selectedConversation?.zapp_conversation_id || 
      selectedConversation?.zapp_conversation?.id || 
      null;
  }, [selectedConversation?.id, selectedConversation?.zapp_conversation_id, selectedConversation?.zapp_conversation?.id]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    const zappConvId = selectedConversation?.zapp_conversation_id || selectedConversation?.zapp_conversation?.id;
    setMessages([]);
    if (zappConvId) {
      fetchMessages(zappConvId);
    }
  }, [selectedConversation?.id, fetchMessages, setMessages]);

  // Realtime subscription for messages in selected conversation
  useEffect(() => {
    const zappConvId = selectedConversation?.zapp_conversation_id || selectedConversation?.zapp_conversation?.id;
    if (!zappConvId || !currentUser?.account_id) return;

    console.log("[ZappMessaging] Setting up realtime for conversation:", zappConvId);

    const messagesChannel = supabase
      .channel(`zapp-messages-${zappConvId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'zapp_messages',
          filter: `zapp_conversation_id=eq.${zappConvId}`
        },
        (payload) => {
          const newMsg = payload.new as any;
          
          if (currentConversationIdRef.current !== zappConvId) return;
          
          if (newMsg.direction === 'outbound' && newMsg.id) {
            const insertTime = new Date(newMsg.sent_at || newMsg.created_at).getTime();
            const now = Date.now();
            if (now - insertTime < 3000) {
              setMessages(prev => {
                const existingByExternal = prev.find(m => 
                  m.external_message_id && m.external_message_id === newMsg.external_message_id
                );
                const existsById = prev.some(m => m.id === newMsg.id);
                if (existsById || existingByExternal) return prev;
                const filtered = prev.filter(m => !m.id.startsWith('temp-audio-'));
                return [...filtered, {
                  id: newMsg.id,
                  content: newMsg.content,
                  is_from_client: newMsg.direction === 'inbound',
                  created_at: newMsg.sent_at || newMsg.created_at,
                  message_type: newMsg.message_type,
                  media_url: newMsg.media_url,
                  media_type: newMsg.media_type,
                  media_mimetype: newMsg.media_mimetype,
                  media_filename: newMsg.media_filename,
                  audio_duration_sec: newMsg.audio_duration_sec,
                  sender_name: newMsg.sender_name,
                  external_message_id: newMsg.external_message_id,
                }];
              });
              return;
            }
          }
          
          fetchMessages(zappConvId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'zapp_messages',
          filter: `zapp_conversation_id=eq.${zappConvId}`
        },
        (payload) => {
          const updatedMsg = payload.new as any;
          if (currentConversationIdRef.current !== zappConvId) return;
          setMessages(prev => prev.map(m => 
            m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [selectedConversation?.id, currentUser?.account_id, fetchMessages, setMessages]);

  // Load quick replies from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`zapp_quick_replies_${currentUser?.account_id}`);
    if (saved) {
      try {
        setQuickReplies(JSON.parse(saved));
      } catch {
        setQuickReplies([]);
      }
    }
  }, [currentUser?.account_id]);

  // Send message via UAZAPI
  const sendMessage = async () => {
    if (imagePreview && selectedConversation) {
      const file = imagePreview.file;
      const caption = imagePreview.caption;
      URL.revokeObjectURL(imagePreview.url);
      setImagePreview(null);
      await sendMediaMessage(file, "image", caption);
      return;
    }

    if (filePreview && selectedConversation) {
      const file = filePreview.file;
      const mediaType: "image" | "video" | "document" = file.type.startsWith('video/') ? 'video' : 'document';
      URL.revokeObjectURL(filePreview.url);
      setFilePreview(null);
      await sendMediaMessage(file, mediaType);
      return;
    }
    
    if (!messageInput.trim() || !selectedConversation) return;
    
    const contactInfo = getContactInfo(selectedConversation);
    const phone = contactInfo.phone;
    const isGroup = contactInfo.isGroup;
    const groupJid = selectedConversation.zapp_conversation?.group_jid;
    
    if (!phone && !groupJid) {
      toast.error("Número de telefone não encontrado");
      return;
    }
    
    const baseMessage = messageInput.trim();
    const messageContent = buildSignedText(baseMessage);
    const tempMessageId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    const conversationId = selectedConversation.zapp_conversation_id;
    const accountId = currentUser!.account_id;
    const conversationIntegrationId = (selectedConversation.zapp_conversation as { integration_id?: string | null } | undefined)?.integration_id;
    const effectiveIntegrationId = conversationIntegrationId || selectedIntegrationId;
    
    if (!effectiveIntegrationId) {
      console.error("[ZAPP-SEND] No integration_id available for this conversation");
      toast.error("WhatsApp não configurado", { description: "Esta conversa não está vinculada a nenhuma instância do WhatsApp. Peça ao administrador para verificar." });
      return;
    }

    // Safety check: never route through a WhatsApp number from another sector
    if (!(await assertIntegrationMatchesSector(effectiveIntegrationId))) return;
    
    const replyContext = replyingTo ? { ...replyingTo } : null;
    
    const optimisticMessage: Message = {
      id: tempMessageId,
      content: messageContent,
      is_from_client: false,
      created_at: now,
      message_type: "text",
      media_url: null,
      media_type: null,
      media_mimetype: null,
      media_filename: null,
      audio_duration_sec: null,
      sender_name: null,
      quoted_message_id: replyContext?.external_message_id || null,
      quoted_content: replyContext?.content || null,
      quoted_sender_name: replyContext?.is_from_client 
        ? (replyContext.sender_name || "Cliente") 
        : "Você",
      send_status: "sending",
      send_error: null,
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setMessageInput("");
    setReplyingTo(null);
    
    const mentionsToSend = [...pendingMentions];
    setPendingMentions([]);
    
    (async () => {
      try {
        const action = isGroup && groupJid ? "send_to_group" : "send_text";
        const payload: Record<string, unknown> = {
          action,
          message: messageContent,
          sector_id: selectedSectorId,
          integration_id: effectiveIntegrationId,
          // Frontend já prepende a assinatura do usuário — evita dupla assinatura no servidor
          add_signature: false,
        };
        
        if (isGroup && groupJid) {
          payload.group_id = groupJid;
          if (mentionsToSend.length > 0) {
            payload.mentions = mentionsToSend.map(m => m.jid);
          }
        } else {
          payload.phone = phone;
        }
        
        if (replyContext?.external_message_id) {
          payload.quoted_message_id = replyContext.external_message_id;
          payload.quoted_from_me = !replyContext.is_from_client;
          if (replyContext.is_from_client && phone) {
            payload.quoted_participant = phone;
          }
        }
        
        const { data: sendResult, error } = await invokeWhatsAppManager(effectiveIntegrationId, payload);
        
        if (error) {
          console.error("[ZAPP-SEND] Edge function error:", JSON.stringify(error));
          throw error;
        }
        if (sendResult?.error) {
          console.error("[ZAPP-SEND] Edge function returned error:", sendResult.error);
          throw new Error(sendResult.error);
        }
        console.log("[ZAPP-SEND] Edge function OK");
        
        const externalId = sendResult?.data?.id || sendResult?.data?.messageid || sendResult?.id || sendResult?.messageid || null;

        // 🚨 CRÍTICO: sem ID externo = WhatsApp NÃO confirmou a entrega (falha silenciosa do uazapi).
        if (!externalId) {
          console.error("[ZAPP-SEND] Resposta sem messageid — provável falha silenciosa:", JSON.stringify(sendResult)?.substring(0, 500));
          throw new Error("WhatsApp não confirmou o envio. Verifique a conexão da instância e tente novamente.");
        }
        
        if (conversationId) {
          const { data: insertedMessage, error: insertErr } = await supabase.from("zapp_messages").insert({
            account_id: accountId,
            zapp_conversation_id: conversationId,
            direction: "outbound",
            content: messageContent,
            message_type: "text",
            sent_at: now,
            external_message_id: externalId,
            delivery_status: "sent",
            sender_user_id: currentUser?.id || null,
            sender_name: currentUser?.name || null,
            quoted_message_id: replyContext?.external_message_id || null,
            quoted_content: replyContext?.content || null,
            quoted_sender_name: replyContext?.is_from_client 
              ? (replyContext.sender_name || "Cliente") 
              : "Você",
          }).select("id").single();

          if (insertErr) {
            console.error("[ZAPP-SEND] Insert zapp_messages error:", insertErr);
          }
          
          if (insertedMessage) {
            setMessages(prev => prev.map(m => 
              m.id === tempMessageId ? { ...m, id: insertedMessage.id, send_status: "sent" as const, delivery_status: "sent" as const, external_message_id: externalId } : m
            ));
          }
          
          supabase.from("zapp_conversations").update({
            last_message_at: now,
            last_message_preview: messageContent.substring(0, 100),
            unread_count: 0,
          }).eq("id", conversationId);
          
          onConversationUpdated?.(conversationId, now, messageContent.substring(0, 100));
        }
      } catch (error: any) {
        console.error("Error sending message:", error);
        
        let errorMsg = error.message || "Erro ao enviar mensagem";
        
        if (error.context?.body) {
          try {
            const errorBody = JSON.parse(error.context.body);
            if (errorBody.error) errorMsg = errorBody.error;
          } catch { /* ignore */ }
        }
        if (error.status === 429 && errorMsg.includes("non-2xx")) {
          errorMsg = "Envio bloqueado temporariamente para proteger o número. Aguarde alguns minutos e personalize a mensagem.";
        }
        
        const isWhatsAppDisconnected = errorMsg.includes("WHATSAPP_DISCONNECTED") || 
                                        errorMsg.includes("desconectado") ||
                                        errorMsg.includes("disconnected");
        
        const isLidNotFound = errorMsg.includes("no LID found") || 
                              errorMsg.includes("LID not found") ||
                              (errorMsg.includes("not found for") && errorMsg.includes("@s.whatsapp.net"));
        
        const isInvalidNumber = errorMsg.includes("invalid") || 
                                errorMsg.includes("Could not parse") ||
                                errorMsg.includes("not valid") ||
                                errorMsg.includes("número inválido") ||
                                errorMsg.includes("formato inválido");
        
        const isPermanentError = isWhatsAppDisconnected || isLidNotFound || isInvalidNumber;
        
        const isTransientError = !isPermanentError && (
          errorMsg.includes("non-2xx") ||
          errorMsg.includes("timeout") ||
          errorMsg.includes("network") ||
          errorMsg.includes("fetch") ||
          errorMsg.includes("500") ||
          errorMsg.includes("503") ||
          errorMsg.includes("502") ||
          errorMsg.includes("504")
        );
        
        const isFirstAttempt = !optimisticMessage.id.includes("-retry");
        
        if (isTransientError && isFirstAttempt) {
          setMessages(prev => prev.map(m => 
            m.id === tempMessageId 
              ? { ...m, send_status: "sending" as const, send_error: "Tentando novamente..." }
              : m
          ));
          
          await new Promise(r => setTimeout(r, 1500));
          
          try {
            const retryAction = isGroup && groupJid ? "send_to_group" : "send_text";
            const retryPayload: Record<string, unknown> = {
              action: retryAction,
              message: messageContent,
              sector_id: selectedSectorId,
              integration_id: effectiveIntegrationId,
              add_signature: false,
            };
            
            if (isGroup && groupJid) {
              retryPayload.group_id = groupJid;
              if (mentionsToSend.length > 0) {
                retryPayload.mentions = mentionsToSend.map(m => m.jid);
              }
            } else {
              retryPayload.phone = phone;
            }
            
            if (replyContext?.external_message_id) {
              retryPayload.quoted_message_id = replyContext.external_message_id;
              retryPayload.quoted_from_me = !replyContext.is_from_client;
              if (replyContext.is_from_client && phone) {
                retryPayload.quoted_participant = phone;
              }
            }
            
            const { error: retryError } = await invokeWhatsAppManager(effectiveIntegrationId, retryPayload);
            
            if (retryError) {
              console.error("[ZAPP-SEND] Retry edge function error:", JSON.stringify(retryError));
              throw retryError;
            }
            
            if (conversationId) {
              const { data: insertedMessage, error: retryInsertErr } = await supabase.from("zapp_messages").insert({
                account_id: accountId,
                zapp_conversation_id: conversationId,
                direction: "outbound",
                content: messageContent,
                message_type: "text",
                sent_at: now,
                sender_user_id: currentUser?.id || null,
                sender_name: currentUser?.name || null,
                quoted_message_id: replyContext?.external_message_id || null,
                quoted_content: replyContext?.content || null,
                quoted_sender_name: replyContext?.is_from_client 
                  ? (replyContext.sender_name || "Cliente") 
                  : "Você",
              }).select("id").single();

              if (retryInsertErr) {
                console.error("[ZAPP-SEND] Retry insert error:", retryInsertErr);
              }
              
              if (insertedMessage) {
                setMessages(prev => prev.map(m => 
                  m.id === tempMessageId ? { ...m, id: insertedMessage.id, send_status: "sent" as const, send_error: null } : m
                ));
              }
              
              supabase.from("zapp_conversations").update({
                last_message_at: now,
                last_message_preview: messageContent.substring(0, 100),
                unread_count: 0,
              }).eq("id", conversationId);
              
              onConversationUpdated?.(conversationId, now, messageContent.substring(0, 100));
            }
            
            return;
          } catch (retryErr: any) {
            errorMsg = retryErr.message || errorMsg;
          }
        }
        
        let userErrorMessage = errorMsg;
        if (isWhatsAppDisconnected) userErrorMessage = "WhatsApp desconectado";
        else if (isLidNotFound) userErrorMessage = "Número não encontrado no WhatsApp";
        else if (isInvalidNumber) userErrorMessage = "Número de telefone inválido ou não registrado no WhatsApp";
        else if (error.status === 429) userErrorMessage = errorMsg;
        
        setMessages(prev => prev.map(m => 
          m.id === tempMessageId 
            ? { ...m, send_status: "failed" as const, send_error: userErrorMessage } 
            : m
        ));
        
        if (isWhatsAppDisconnected) {
          toast.error("WhatsApp desconectado. Reconecte nas configurações para enviar mensagens.", {
            duration: 6000,
            action: { label: "Ir para Configurações", onClick: () => navigate("/settings") },
          });
        } else if (isLidNotFound) {
          toast.error("Este número não está cadastrado no WhatsApp ou é inválido.", { duration: 8000 });
        } else if (isInvalidNumber) {
          toast.error("Número de telefone inválido. Verifique o formato e tente novamente.", { duration: 8000 });
        } else {
          toast.error(errorMsg);
        }
      }
    })();
  };

  // Send media message (image/document/video)
  const sendMediaMessage = async (file: File, mediaType: "image" | "document" | "video", caption?: string) => {
    if (!selectedConversation || uploadingMedia) return;
    
    const contactInfo = getContactInfo(selectedConversation);
    const phone = contactInfo.phone;
    const isGroup = contactInfo.isGroup;
    const groupJid = selectedConversation.zapp_conversation?.group_jid;
    const conversationIntegrationId = (selectedConversation.zapp_conversation as { integration_id?: string | null } | undefined)?.integration_id;
    const effectiveIntegrationId = conversationIntegrationId || selectedIntegrationId;
    
    if (!phone && !groupJid) {
      toast.error("Número de telefone não encontrado");
      return;
    }

    // Safety check: never route through a WhatsApp number from another sector
    if (!(await assertIntegrationMatchesSector(effectiveIntegrationId))) {
      return;
    }

    setUploadingMedia(true);
    const tempMessageId = `temp-media-${Date.now()}`;
    const now = new Date().toISOString();
    const signedCaption = caption ? buildSignedText(caption) : "";
    
    const optimisticMessage: Message = {
      id: tempMessageId,
      content: signedCaption || (mediaType === "image" ? "" : mediaType === "video" ? "" : file.name),
      is_from_client: false,
      created_at: now,
      message_type: mediaType,
      media_url: URL.createObjectURL(file),
      media_type: mediaType,
      media_mimetype: file.type,
      media_filename: file.name,
      audio_duration_sec: null,
      sender_name: null,
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${currentUser!.account_id}/${Date.now()}/${safeName}`;
      const bucket = "zapp-media";
      
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      
      if (uploadError) {
        console.error("[ZAPP-MEDIA] Storage upload error:", uploadError);
        throw uploadError;
      }
      console.log("[ZAPP-MEDIA] Storage upload OK");
      
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
      const mediaUrl = urlData.publicUrl;
      
      const action = isGroup && groupJid ? "send_media_to_group" : "send_media";
      const payload: Record<string, string | boolean> = {
        action,
        media_url: mediaUrl,
        media_type: mediaType,
        caption: signedCaption,
        file_name: file.name,
        sector_id: selectedSectorId || "",
        integration_id: effectiveIntegrationId || "",
        add_signature: false,
      };
      
      if (isGroup && groupJid) {
        payload.group_id = groupJid;
      } else {
        payload.phone = phone;
      }
      
      const { data, error } = await invokeWhatsAppManager(effectiveIntegrationId, payload);
      
      if (error) {
        console.error("[ZAPP-MEDIA] Edge function error:", error);
        throw error;
      }
      if (data?.error) {
        console.error("[ZAPP-MEDIA] Edge function data error:", data.error);
        throw new Error(data.error || "Falha ao enviar mídia");
      }
      const externalId = data?.data?.id || data?.data?.messageid || data?.id || data?.messageid || null;
      console.log("[ZAPP-MEDIA] Edge function OK, externalId:", externalId);

      // 🚨 CRÍTICO: sem ID externo = WhatsApp NÃO confirmou a entrega.
      if (!externalId) {
        console.error("[ZAPP-MEDIA] Resposta sem messageid — provável falha silenciosa:", JSON.stringify(data)?.substring(0, 500));
        throw new Error("WhatsApp não confirmou o envio da mídia. Verifique a conexão da instância e tente novamente.");
      }
      
      if (selectedConversation.zapp_conversation_id) {
        const { data: insertedMessage, error: insertError } = await supabase.from("zapp_messages").insert({
          account_id: currentUser!.account_id,
          zapp_conversation_id: selectedConversation.zapp_conversation_id,
          direction: "outbound",
          content: signedCaption || (mediaType === "image" ? "" : mediaType === "video" ? "" : file.name),
          message_type: mediaType,
          media_url: mediaUrl,
          media_type: mediaType,
          media_mimetype: file.type,
          media_filename: file.name,
          sent_at: now,
          external_message_id: externalId,
          sender_user_id: currentUser?.id || null,
          sender_name: currentUser?.name || null,
        }).select("id").single();

        if (insertError) {
          console.error("[ZAPP-MEDIA] Insert zapp_messages error:", insertError);
          throw insertError;
        }
        console.log("[ZAPP-MEDIA] Insert zapp_messages OK:", insertedMessage?.id);
        
        if (insertedMessage) {
          setMessages(prev => prev.map(m => 
            m.id === tempMessageId ? { ...m, id: insertedMessage.id, media_url: mediaUrl, external_message_id: externalId } : m
          ));
        }
        
        const mediaPreview = mediaType === "image" ? "📷 Imagem" : mediaType === "video" ? "🎬 Vídeo" : `📎 ${file.name}`;
        await supabase.from("zapp_conversations").update({
          last_message_at: now,
          last_message_preview: mediaPreview,
          unread_count: 0,
        }).eq("id", selectedConversation.zapp_conversation_id);
        
        onConversationUpdated?.(selectedConversation.zapp_conversation_id, now, mediaPreview);
      }
      
      toast.success(mediaType === "image" ? "Imagem enviada!" : mediaType === "video" ? "Vídeo enviado!" : "Arquivo enviado!");
    } catch (error: any) {
      console.error("Error sending media:", error);
      setMessages(prev => prev.filter(m => m.id !== tempMessageId));
      toast.error(error.message || "Erro ao enviar mídia");
    } finally {
      setUploadingMedia(false);
    }
  };

  // Handle file input change
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, mediaType: "image" | "document") => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Máximo 50MB.");
        return;
      }
      const resolvedType: "image" | "document" | "video" = file.type.startsWith('video/') ? 'video' : mediaType;
      sendMediaMessage(file, resolvedType);
    }
    e.target.value = "";
  };

  // Start audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) mimeType = 'audio/ogg;codecs=opus';
      else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
      else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (audioChunksRef.current.length > 0) {
          const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
          let audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
          
          // Calculate actual duration from wall clock (avoids stale closure on state)
          const elapsedMs = Date.now() - recordingStartTimeRef.current;
          const elapsedSec = Math.max(1, Math.round(elapsedMs / 1000));
          
          // Fix WebM duration metadata (Chrome records without it)
          if (actualMimeType.includes('webm')) {
            try {
              audioBlob = await fixWebmDuration(audioBlob, elapsedMs, { logger: false });
            } catch (e) {
              console.warn("[AudioRecorder] fixWebmDuration failed, using raw blob:", e);
            }
          }
          
          const audioUrl = URL.createObjectURL(audioBlob);
          setAudioPreview({ blob: audioBlob, url: audioUrl, duration: elapsedSec });
        }
      };
      
      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingStartTimeRef.current = Date.now();
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      toast.success("Gravando áudio...");
    } catch (error: any) {
      console.error("Error starting recording:", error);
      toast.error("Erro ao acessar microfone. Verifique as permissões.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      const stream = mediaRecorderRef.current.stream;
      stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setRecordingDuration(0);
      recordingStartTimeRef.current = 0;
      toast.info("Gravação cancelada");
    }
  };

  const discardAudioPreview = () => {
    if (audioPreview) {
      URL.revokeObjectURL(audioPreview.url);
      setAudioPreview(null);
      setRecordingDuration(0);
    }
  };

  const confirmAudioSend = async () => {
    if (audioPreview) {
      await sendAudioMessage(audioPreview.blob, audioPreview.duration);
      URL.revokeObjectURL(audioPreview.url);
      setAudioPreview(null);
      setRecordingDuration(0);
    }
  };

  // Send audio message
  const sendAudioMessage = async (audioBlob: Blob, duration?: number) => {
    if (!selectedConversation || uploadingMedia) return;
    
    const contactInfo = getContactInfo(selectedConversation);
    const phone = contactInfo.phone;
    const isGroup = contactInfo.isGroup;
    const groupJid = selectedConversation.zapp_conversation?.group_jid;
    const conversationIntegrationId = (selectedConversation.zapp_conversation as { integration_id?: string | null } | undefined)?.integration_id;
    const effectiveIntegrationId = conversationIntegrationId || selectedIntegrationId;
    
    if (!phone && !groupJid) {
      toast.error("Número de telefone não encontrado");
      return;
    }

    // Safety check: never route through a WhatsApp number from another sector
    if (!(await assertIntegrationMatchesSector(effectiveIntegrationId))) {
      return;
    }

    setUploadingMedia(true);
    const now = new Date().toISOString();
    let insertedMessageId: string | null = null;
    
    try {
      const isOgg = audioBlob.type.includes('ogg');
      const extension = isOgg ? 'ogg' : 'webm';
      const fileName = `${currentUser!.account_id}/audio_${Date.now()}.${extension}`;
      const bucket = "zapp-media";
      
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, audioBlob, { contentType: audioBlob.type, cacheControl: '3600', upsert: false });
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
      const mediaUrl = urlData.publicUrl;
      
      if (selectedConversation.zapp_conversation_id) {
        const { data: insertedMessage, error: insertError } = await supabase.from("zapp_messages").insert({
          account_id: currentUser!.account_id,
          zapp_conversation_id: selectedConversation.zapp_conversation_id,
          direction: "outbound",
          content: "",
          message_type: "audio",
          media_url: mediaUrl,
          media_type: "audio",
          media_mimetype: audioBlob.type,
          media_filename: `audio_${Date.now()}.webm`,
          audio_duration_sec: duration || null,
          media_download_status: "completed",
          sent_at: now,
          sender_user_id: currentUser?.id || null,
          sender_name: currentUser?.name || null,
        }).select("id").single();
        
        if (insertError) throw insertError;
        insertedMessageId = insertedMessage?.id || null;
        
        if (insertedMessageId) {
          const optimisticMessage: Message = {
            id: insertedMessageId,
            content: "",
            is_from_client: false,
            created_at: now,
            message_type: "audio",
            media_url: mediaUrl,
            media_type: "audio",
            media_mimetype: audioBlob.type,
            media_filename: `audio_${Date.now()}.webm`,
            audio_duration_sec: duration || null,
            sender_name: null,
            delivery_status: "pending",
          };
          
          setMessages(prev => {
            const exists = prev.some(m => m.id === insertedMessageId);
            if (exists) return prev;
            const filtered = prev.filter(m => !m.id.startsWith('temp-audio-'));
            return [...filtered, optimisticMessage];
          });
        }
        
        const action = isGroup && groupJid ? "send_media_to_group" : "send_media";
        const payload: Record<string, string | boolean> = {
          action,
          media_url: mediaUrl,
          media_type: "ptt",
          caption: "",
          file_name: `audio_${Date.now()}.${extension}`,
          sector_id: selectedSectorId || "",
          integration_id: effectiveIntegrationId || "",
          add_signature: false,
        };
        
        if (isGroup && groupJid) {
          payload.group_id = groupJid;
        } else {
          payload.phone = phone;
        }
        
        const { data, error } = await invokeWhatsAppManager(effectiveIntegrationId, payload);
        
        if (error) {
          if (insertedMessageId) {
            failedAudiosRef.current.set(insertedMessageId, { blob: audioBlob, duration });
            await supabase.from("zapp_messages").update({
              media_download_status: "failed",
            }).eq("id", insertedMessageId);
            setMessages(prev => prev.map(m =>
              m.id === insertedMessageId
                ? { ...m, send_status: "failed" as const, send_error: error.message || "Falha ao enviar áudio", delivery_status: "failed" as const }
                : m
            ));
          }
          throw error;
        }
        
        const innerData = data?.data || data;
        if (!innerData?.success && innerData?.message) {
          if (insertedMessageId) {
            failedAudiosRef.current.set(insertedMessageId, { blob: audioBlob, duration });
            setMessages(prev => prev.map(m =>
              m.id === insertedMessageId
                ? { ...m, send_status: "failed" as const, send_error: innerData.message || "Falha ao enviar áudio", delivery_status: "failed" as const }
                : m
            ));
          }
          throw new Error(innerData.message || "Falha ao enviar áudio");
        }
        
        const audioExternalId = innerData?.id || innerData?.messageid || data?.data?.id || data?.data?.messageid || null;
        
        // 🚨 CRÍTICO: sem ID externo, o uazapi NÃO confirmou entrega ao WhatsApp.
        // Mantemos a bolha como "falhou" e guardamos o blob pra reenvio em 1 clique.
        if (!audioExternalId) {
          console.error("[ZAPP-AUDIO] Resposta sem messageid — provável falha silenciosa:", JSON.stringify(data)?.substring(0, 500));
          if (insertedMessageId) {
            failedAudiosRef.current.set(insertedMessageId, { blob: audioBlob, duration });
            setMessages(prev => prev.map(m =>
              m.id === insertedMessageId
                ? { ...m, send_status: "failed" as const, send_error: "WhatsApp não confirmou o envio. Toque em Reenviar áudio.", delivery_status: "failed" as const }
                : m
            ));
          }
          throw new Error("WhatsApp não confirmou o envio do áudio. Toque em Reenviar áudio.");
        }
        
        if (insertedMessageId) {
          await supabase.from("zapp_messages").update({ external_message_id: audioExternalId }).eq("id", insertedMessageId);
        }
        
        setMessages(prev => prev.map(m => 
          m.id === insertedMessageId 
            ? { ...m, delivery_status: "sent" as const, external_message_id: audioExternalId, send_status: "sent" as const, send_error: null }
            : m
        ));
        
        await supabase.from("zapp_conversations").update({
          last_message_at: now,
          last_message_preview: "🎤 Áudio",
          unread_count: 0,
        }).eq("id", selectedConversation.zapp_conversation_id);
        
        onConversationUpdated?.(selectedConversation.zapp_conversation_id, now, "🎤 Áudio");
      }
      
      toast.success("Áudio enviado!");
    } catch (error: any) {
      console.error("Error sending audio:", error);
      toast.error(error.message || "Erro ao enviar áudio.");
    } finally {
      setUploadingMedia(false);
    }
  };

  const formatRecordingDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle delete message
  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedConversation) return;
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    if (messageId.startsWith("temp-")) return;
    
    try {
      let whatsappDeleted = false;
      
      if (message.external_message_id) {
        const intId = (selectedConversation.zapp_conversation as any)?.integration_id || selectedIntegrationId;
        if (!(await assertIntegrationMatchesSector(intId))) return;
        const { data, error } = await invokeWhatsAppManager(intId, {
            action: "delete_message",
            message_id: message.external_message_id,
            phone: getContactInfo(selectedConversation).phone,
            sector_id: selectedSectorId || "",
        });
        
        if (!error && data?.data?.deleted) {
          whatsappDeleted = true;
        } else {
          const errorMsg = data?.data?.error || data?.error || "Unknown error";
          if (errorMsg.includes("7 minutos") || errorMsg.includes("time") || errorMsg.includes("expired")) {
            toast.warning("Mensagens só podem ser apagadas para todos em até 7 minutos após o envio");
          }
        }
      }
      
      const { data: updateData, error: updateError } = await supabase
        .from("zapp_messages")
        .update({ is_deleted: true, deleted_at: new Date().toISOString(), content: "🚫 Mensagem apagada" })
        .eq("id", messageId)
        .select();
      
      if (updateError) throw updateError;
      if (!updateData || updateData.length === 0) {
        toast.error("Mensagem não encontrada no banco de dados");
        return;
      }
      
      toast.success(whatsappDeleted ? "Mensagem apagada para todos" : "Mensagem apagada localmente");
    } catch (error: any) {
      console.error("Error deleting message:", error);
      toast.error(error.message || "Erro ao apagar mensagem");
    }
  };

  // Handle editing a message
  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!selectedConversation || !newContent.trim()) return;
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    try {
      let whatsappEdited = false;
      
      if (message.external_message_id) {
        const intId2 = (selectedConversation.zapp_conversation as any)?.integration_id || selectedIntegrationId;
        if (!(await assertIntegrationMatchesSector(intId2))) return;
        const { data, error } = await invokeWhatsAppManager(intId2, {
            action: "edit_message",
            message_id: message.external_message_id,
            new_content: newContent.trim(),
            phone: getContactInfo(selectedConversation).phone,
            sector_id: selectedSectorId || "",
        });
        
        if (!error && data?.data?.edited) whatsappEdited = true;
      }
      
      const { error: updateError } = await supabase
        .from("zapp_messages")
        .update({ content: newContent.trim(), updated_at: new Date().toISOString(), is_edited: true })
        .eq("id", messageId);
      
      if (updateError) throw updateError;
      
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, content: newContent.trim(), is_edited: true } : m
      ));
      
      toast.success(whatsappEdited ? "Mensagem editada" : "Mensagem editada localmente");
    } catch (error: any) {
      console.error("Error editing message:", error);
      toast.error(error.message || "Erro ao editar mensagem");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Send contact to conversation
  const sendContact = async (client: { id: string; full_name: string; phone_e164: string }) => {
    if (!selectedConversation || sendingContact) return;
    
    const contactInfo = getContactInfo(selectedConversation);
    const phone = contactInfo.phone;
    const isGroup = contactInfo.isGroup;
    const groupJid = selectedConversation.zapp_conversation?.group_jid;
    const conversationIntegrationId = (selectedConversation.zapp_conversation as { integration_id?: string | null } | undefined)?.integration_id;
    const effectiveIntegrationId = conversationIntegrationId || selectedIntegrationId;
    
    if (!phone && !groupJid) {
      toast.error("Número de telefone não encontrado");
      return;
    }

    // Safety check: never route through a WhatsApp number from another sector
    if (!(await assertIntegrationMatchesSector(effectiveIntegrationId))) {
      return;
    }

    setSendingContact(true);
    const contactMessage = `📇 *Contato*\n*Nome:* ${client.full_name}\n*Telefone:* ${client.phone_e164}`;
    const tempMessageId = `temp-contact-${Date.now()}`;
    const now = new Date().toISOString();
    
    const optimisticMessage: Message = {
      id: tempMessageId,
      content: contactMessage,
      is_from_client: false,
      created_at: now,
      message_type: "text",
      media_url: null,
      media_type: null,
      media_mimetype: null,
      media_filename: null,
      audio_duration_sec: null,
      sender_name: null,
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setContactPickerOpen(false);
    
    try {
      const action = isGroup && groupJid ? "send_to_group" : "send_text";
      const payload: Record<string, string> = {
        action,
        message: contactMessage,
        sector_id: selectedSectorId || "",
        integration_id: effectiveIntegrationId || "",
      };
      
      if (isGroup && groupJid) {
        payload.group_id = groupJid;
      } else {
        payload.phone = phone;
      }
      
      const { data: contactSendResult, error } = await invokeWhatsAppManager(effectiveIntegrationId, payload);
      if (error) {
        console.error("[ZAPP-CONTACT] Edge function error:", JSON.stringify(error));
        throw error;
      }
      
      const contactExternalId = contactSendResult?.data?.id || contactSendResult?.data?.messageid || contactSendResult?.id || contactSendResult?.messageid || null;

      // 🚨 CRÍTICO: sem ID externo = WhatsApp NÃO confirmou a entrega.
      if (!contactExternalId) {
        console.error("[ZAPP-CONTACT] Resposta sem messageid — provável falha silenciosa:", JSON.stringify(contactSendResult)?.substring(0, 500));
        throw new Error("WhatsApp não confirmou o envio do contato. Verifique a conexão da instância e tente novamente.");
      }
      
      if (selectedConversation.zapp_conversation_id) {
        const { data: insertedMessage, error: contactInsertErr } = await supabase.from("zapp_messages").insert({
          account_id: currentUser!.account_id,
          zapp_conversation_id: selectedConversation.zapp_conversation_id,
          direction: "outbound",
          content: contactMessage,
          message_type: "text",
          sent_at: now,
          external_message_id: contactExternalId,
          sender_user_id: currentUser?.id || null,
          sender_name: currentUser?.name || null,
        }).select("id").single();

        if (contactInsertErr) {
          console.error("[ZAPP-CONTACT] Insert error:", contactInsertErr);
          toast.error("Contato enviado mas falha ao salvar: " + contactInsertErr.message);
        }
        
        if (insertedMessage) {
          setMessages(prev => prev.map(m => 
            m.id === tempMessageId ? { ...m, id: insertedMessage.id, external_message_id: contactExternalId } : m
          ));
        }
        
        const contactPreview = `📇 ${client.full_name}`;
        await supabase.from("zapp_conversations").update({
          last_message_at: now,
          last_message_preview: contactPreview,
          unread_count: 0,
        }).eq("id", selectedConversation.zapp_conversation_id);
        
        onConversationUpdated?.(selectedConversation.zapp_conversation_id, now, contactPreview);
      }
      
      toast.success("Contato enviado!");
    } catch (error: any) {
      console.error("Error sending contact:", error);
      setMessages(prev => prev.filter(m => m.id !== tempMessageId));
      toast.error(error.message || "Erro ao enviar contato");
    } finally {
      setSendingContact(false);
    }
  };

  const useQuickReply = (reply: { title: string; content: string }) => {
    setMessageInput(reply.content);
    setQuickRepliesOpen(false);
    messageInputRef.current?.focus();
  };

  const saveQuickReply = () => {
    if (!quickReplyForm.title.trim() || !quickReplyForm.content.trim()) {
      toast.error("Preencha título e conteúdo");
      return;
    }
    setSavingQuickReply(true);
    
    let updated: { id: string; title: string; content: string }[];
    if (editingQuickReply) {
      updated = quickReplies.map(r => 
        r.id === editingQuickReply.id 
          ? { ...r, title: quickReplyForm.title, content: quickReplyForm.content }
          : r
      );
    } else {
      updated = [...quickReplies, { id: `qr-${Date.now()}`, title: quickReplyForm.title, content: quickReplyForm.content }];
    }
    
    setQuickReplies(updated);
    localStorage.setItem(`zapp_quick_replies_${currentUser?.account_id}`, JSON.stringify(updated));
    setQuickReplyDialogOpen(false);
    setEditingQuickReply(null);
    setQuickReplyForm({ title: "", content: "" });
    setSavingQuickReply(false);
    toast.success(editingQuickReply ? "Resposta atualizada!" : "Resposta rápida criada!");
  };

  const deleteQuickReply = (id: string) => {
    const updated = quickReplies.filter(r => r.id !== id);
    setQuickReplies(updated);
    localStorage.setItem(`zapp_quick_replies_${currentUser?.account_id}`, JSON.stringify(updated));
    toast.success("Resposta removida!");
  };

  // Insert formatting
  const insertFormatting = useCallback((formatType: 'bold' | 'italic' | 'strikethrough' | 'monospace') => {
    const input = messageInputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const selectedText = messageInput.substring(start, end);
    
    let prefix = '';
    let suffix = '';
    
    switch (formatType) {
      case 'bold': prefix = '*'; suffix = '*'; break;
      case 'italic': prefix = '_'; suffix = '_'; break;
      case 'strikethrough': prefix = '~'; suffix = '~'; break;
      case 'monospace': prefix = '```'; suffix = '```'; break;
    }
    
    const newText = messageInput.substring(0, start) + prefix + selectedText + suffix + messageInput.substring(end);
    setMessageInput(newText);
    
    setTimeout(() => {
      input.focus();
      const newCursorPos = selectedText ? start + prefix.length + selectedText.length + suffix.length : start + prefix.length;
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [messageInput]);

  // Retry media download
  const retryMediaDownload = async (messageId: string) => {
    const { error } = await supabase
      .from("zapp_messages")
      .update({ media_download_status: "pending" })
      .eq("id", messageId);
    
    if (error) {
      toast.error("Erro ao solicitar redownload");
      return;
    }
    
    supabase.functions.invoke("download-media", {
      body: { message_ids: [messageId] }
    }).then(({ data, error: invokeError }) => {
      if (invokeError) {
        toast.error("Erro ao baixar mídia");
      } else if (data?.successful > 0) {
        if (selectedConversation?.zapp_conversation_id) {
          fetchMessages(selectedConversation.zapp_conversation_id);
        }
      }
    });
    
    toast.info("Tentando baixar mídia novamente...");
  };

  // Retry failed message
  const retryMessage = (msg: Message) => {
    // Áudio: reenviar em 1 clique usando o blob em cache
    if (msg.message_type === "audio") {
      const cached = failedAudiosRef.current.get(msg.id);
      if (!cached) {
        toast.error("Áudio original não disponível para reenvio. Grave novamente.");
        return;
      }
      // Marcar bolha atual como "enviando" enquanto refazemos a tentativa
      setMessages(prev => prev.map(m =>
        m.id === msg.id
          ? { ...m, send_status: "sending" as const, send_error: "Reenviando áudio...", delivery_status: "pending" as const }
          : m
      ));
      // Remover bolha antiga e disparar novo envio (cria nova bolha)
      setMessages(prev => prev.filter(m => m.id !== msg.id));
      failedAudiosRef.current.delete(msg.id);
      // Apagar registro órfão antigo no banco
      supabase.from("zapp_messages").delete().eq("id", msg.id).then(() => {});
      sendAudioMessage(cached.blob, cached.duration);
      toast.info("Reenviando áudio...");
      return;
    }
    // Texto: restaurar no input
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    setMessageInput(msg.content || "");
    messageInputRef.current?.focus();
    toast.info("Mensagem restaurada para reenvio");
  };

  // Handle reply
  const handleReplyMessage = (msg: Message) => {
    setReplyingTo({
      id: msg.id,
      content: msg.content,
      sender_name: msg.sender_name || null,
      is_from_client: msg.is_from_client,
      external_message_id: msg.external_message_id || null,
    });
    messageInputRef.current?.focus();
  };

  // Handle mention insert
  const handleMentionInsert = (mention: { phone: string; jid: string }) => {
    setPendingMentions(prev => [...prev, mention]);
  };

  return {
    // Message input state
    messageInput,
    setMessageInput,
    sendingMessage,
    isRecording,
    recordingDuration,
    audioPreview,
    imagePreview,
    setImagePreview,
    filePreview,
    setFilePreview,
    showFormatting,
    setShowFormatting,
    uploadingMedia,
    replyingTo,
    setReplyingTo,
    messageInputRef,
    imageInputRef,
    fileInputRef,

    // Contact picker
    contactPickerOpen,
    setContactPickerOpen,
    contactSearch,
    setContactSearch,
    sendingContact,

    // Quick replies
    quickRepliesOpen,
    setQuickRepliesOpen,
    quickReplies,
    quickReplyDialogOpen,
    setQuickReplyDialogOpen,
    editingQuickReply,
    setEditingQuickReply,
    quickReplyForm,
    setQuickReplyForm,
    savingQuickReply,

    // Actions
    sendMessage,
    sendMediaMessage,
    handleFileSelect,
    startRecording,
    stopRecording,
    cancelRecording,
    discardAudioPreview,
    confirmAudioSend,
    handleDeleteMessage,
    handleEditMessage,
    handleKeyPress,
    sendContact,
    useQuickReply,
    saveQuickReply,
    deleteQuickReply,
    insertFormatting,
    formatRecordingDuration,
    retryMediaDownload,
    retryMessage,
    handleReplyMessage,
    handleMentionInsert,
  };
}
