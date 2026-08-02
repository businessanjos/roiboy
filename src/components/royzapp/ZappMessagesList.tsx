import { useRef, useLayoutEffect, useMemo, useState, useCallback, useEffect } from "react";
import { MessageSquare, Loader2, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Message } from "@/hooks/useZappData";
import { ZappMessageBubble } from "./ZappMessageBubble";

interface ZappMessagesListProps {
  messages: Message[];
  /** Id da conversa aberta — usado para detectar troca de conversa. */
  conversationId?: string | null;
  isGroup: boolean;
  onReplyMessage?: (message: Message) => void;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => Promise<void>;
  onRetryMessage?: (message: Message) => void;
  onRetryMediaDownload?: (messageId: string) => void;
  searchQuery?: string;
  searchMatchIds?: string[];
  searchFocusId?: string | null;
  /** Existem mensagens mais antigas no banco além das carregadas. */
  hasMoreMessages?: boolean;
  /** Está carregando o bloco anterior do histórico. */
  isLoadingOlderMessages?: boolean;
  /** Carrega o bloco anterior do histórico. */
  onLoadOlderMessages?: () => void;
}

// Build a fallback mention map from sender_phone data in group messages
// Maps phone numbers (without +) to sender names, with multiple digit variants for matching
function buildFallbackMentionMap(messages: Message[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const msg of messages) {
    if (msg.sender_name && msg.sender_name !== "Desconhecido") {
      const phone = msg.sender_phone;
      if (phone) {
        const digits = phone.replace(/\D/g, "");
        if (digits) {
          // Store full number and partial variants for flexible matching
          if (!map[digits]) map[digits] = msg.sender_name;
          const last8 = digits.slice(-8);
          const last9 = digits.slice(-9);
          const last10 = digits.slice(-10);
          const last11 = digits.slice(-11);
          if (last8 && !map[last8]) map[last8] = msg.sender_name;
          if (last9 && !map[last9]) map[last9] = msg.sender_name;
          if (last10 && !map[last10]) map[last10] = msg.sender_name;
          if (last11 && !map[last11]) map[last11] = msg.sender_name;
        }
      }
    }
    // Also merge any existing mention_map from the message into the fallback
    if (msg.mention_map) {
      for (const [key, name] of Object.entries(msg.mention_map)) {
        if (name && !map[key]) {
          map[key] = name;
          const last8 = key.slice(-8);
          const last9 = key.slice(-9);
          const last10 = key.slice(-10);
          const last11 = key.slice(-11);
          if (last8 && !map[last8]) map[last8] = name;
          if (last9 && !map[last9]) map[last9] = name;
          if (last10 && !map[last10]) map[last10] = name;
          if (last11 && !map[last11]) map[last11] = name;
        }
      }
    }
  }
  return map;
}

// extractUnresolvedJids removed — no longer doing DB lookups for mentions

export function ZappMessagesList({
  messages,
  conversationId = null,
  isGroup,
  onReplyMessage,
  onDeleteMessage,
  onEditMessage,
  onRetryMessage,
  onRetryMediaDownload,
  searchQuery,
  searchMatchIds,
  searchFocusId,
  hasMoreMessages = false,
  isLoadingOlderMessages = false,
  onLoadOlderMessages,
}: ZappMessagesListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  // Guarda a altura do scroll antes de carregar histórico, para manter a
  // posição visual quando mensagens antigas são inseridas no topo.
  const pendingRestoreRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const firstMessageIdRef = useRef<string | null>(null);
  // Conversa atual + janela de "grudar no fim" enquanto mídias/áudios ainda
  // mudam a altura logo após abrir a conversa.
  const conversationKeyRef = useRef<string | null>(null);
  const pinBottomUntilRef = useRef<number>(0);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Deduplicate messages to prevent visual duplicates from race conditions
  // Priority: real messages over temp, dedupe by external_message_id when available
  // Special handling for audio messages which can have duplicate records with different content
  // CRITICAL FIX: Use 30-second buckets (increased from 5s) as safety fallback
  const deduplicatedMessages = useMemo(() => {
    const seen = new Map<string, boolean>();
    const result: Message[] = [];
    
    // Group outbound audio messages by approximate time (30-second buckets) for deduplication
    // This handles the case where frontend and webhook create separate records
    const audioTimeMap = new Map<string, Message[]>();
    
    for (const msg of messages) {
      if (msg.message_type === 'audio' && !msg.is_from_client) {
        // Use 30-second buckets (30000ms) for more aggressive deduplication
        const timeKey = String(Math.floor(new Date(msg.created_at).getTime() / 30000));
        if (!audioTimeMap.has(timeKey)) {
          audioTimeMap.set(timeKey, []);
        }
        audioTimeMap.get(timeKey)!.push(msg);
      }
    }
    
    // For each time bucket with multiple audios, prefer the one with external_message_id and duration
    const duplicateAudioIds = new Set<string>();
    for (const [timeKey, audioMsgs] of audioTimeMap) {
      if (audioMsgs.length > 1) {
        console.log(`[DEDUPE] Found ${audioMsgs.length} audio messages in 30s bucket ${timeKey}`);
        
        // Sort: prefer messages with external_message_id and non-zero duration
        audioMsgs.sort((a, b) => {
          // Prefer real messages over temp
          if (!a.id.startsWith('temp-') && b.id.startsWith('temp-')) return -1;
          if (a.id.startsWith('temp-') && !b.id.startsWith('temp-')) return 1;
          // Prefer messages with external_message_id
          if (a.external_message_id && !b.external_message_id) return -1;
          if (!a.external_message_id && b.external_message_id) return 1;
          // Prefer messages with duration
          if ((a.audio_duration_sec || 0) > (b.audio_duration_sec || 0)) return -1;
          if ((a.audio_duration_sec || 0) < (b.audio_duration_sec || 0)) return 1;
          return 0;
        });
        
        // Mark all but the first (best) as duplicates
        for (let i = 1; i < audioMsgs.length; i++) {
          console.log(`[DEDUPE] Filtering duplicate audio: ${audioMsgs[i].id}`);
          duplicateAudioIds.add(audioMsgs[i].id);
        }
      }
    }
    
    // Process from oldest to newest to maintain order
    for (const msg of messages) {
      // Skip duplicate audio messages identified above
      if (duplicateAudioIds.has(msg.id)) {
        continue;
      }
      
      // Skip temporary messages if a real version exists (30s window)
      if (msg.id.startsWith('temp-')) {
        const hasRecentRealAudio = messages.some(m => 
          !m.id.startsWith('temp-') && 
          m.message_type === 'audio' &&
          m.is_from_client === false &&
          Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime()) < 30000
        );
        if (hasRecentRealAudio) {
          continue;
        }
      }
      
      // Deduplicate by external_message_id if available (prevents webhook duplicates)
      const dedupeKey = msg.external_message_id || msg.id;
      if (!seen.has(dedupeKey)) {
        seen.set(dedupeKey, true);
        result.push(msg);
      }
    }
    
    return result;
  }, [messages]);

  // Build fallback mention map from sender_phone data for groups
  const fallbackMentionMap = useMemo(() => {
    if (!isGroup) return {};
    return buildFallbackMentionMap(deduplicatedMessages);
  }, [isGroup, deduplicatedMessages]);

  // Combined mention map: only use fallback from sender data + webhook mention_map
  const combinedMentionMap = useMemo(() => {
    return fallbackMentionMap;
  }, [fallbackMentionMap]);

  // Build a lookup map by external_message_id for quoted content resolution
  const messagesByExternalId = useMemo(() => {
    const map = new Map<string, Message>();
    for (const msg of deduplicatedMessages) {
      if (msg.external_message_id) {
        map.set(msg.external_message_id, msg);
      }
    }
    return map;
  }, [deduplicatedMessages]);

  // Enrich messages: merge mention names + fill missing quoted content from loaded messages
  const enrichedMessages = useMemo(() => {
    const mentionRegex = /@\d{5,}/;
    return deduplicatedMessages.map(msg => {
      let enriched = msg;

      // Fill missing quoted_content by looking up the original message
      if (msg.quoted_message_id && !msg.quoted_content) {
        const originalMsg = messagesByExternalId.get(msg.quoted_message_id);
        if (originalMsg) {
          const resolvedContent = originalMsg.content || 
            (originalMsg.message_type === 'image' ? '📷 Imagem' :
             originalMsg.message_type === 'video' ? '🎬 Vídeo' :
             originalMsg.message_type === 'audio' ? '🎤 Áudio' :
             originalMsg.message_type === 'document' ? '📄 Documento' :
             originalMsg.message_type === 'sticker' ? '🎨 Figurinha' : null);
          const resolvedSender = msg.quoted_sender_name || originalMsg.sender_name || 
            (originalMsg.is_from_client ? 'Cliente' : 'Você');
          enriched = { 
            ...enriched, 
            quoted_content: resolvedContent, 
            quoted_sender_name: resolvedSender 
          };
        }
      }

      // Merge mention names for group messages
      if (isGroup && enriched.content && mentionRegex.test(enriched.content)) {
        const merged = { ...combinedMentionMap, ...(enriched.mention_map || {}) };
        const cleaned: Record<string, string> = {};
        for (const [k, v] of Object.entries(merged)) {
          if (v) cleaned[k] = v;
        }
        enriched = { ...enriched, mention_map: Object.keys(cleaned).length > 0 ? cleaned : null };
      }

      return enriched;
    });
  }, [deduplicatedMessages, isGroup, combinedMentionMap, messagesByExternalId]);

  // Scroll to quoted message handler
  const handleScrollToQuoted = useCallback((quotedMessageId: string) => {
    // Find message by external_message_id OR local id
    const targetMessage = enrichedMessages.find(
      m => m.external_message_id === quotedMessageId || m.id === quotedMessageId
    );
    
    if (targetMessage) {
      const element = messageRefs.current.get(targetMessage.id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedMessageId(targetMessage.id);
        
        // Remove highlight after 2 seconds
        setTimeout(() => setHighlightedMessageId(null), 2000);
      }
    }
  }, [enrichedMessages]);

  // Clean up old refs when messages change
  useEffect(() => {
    const currentIds = new Set(enrichedMessages.map(m => m.id));
    messageRefs.current.forEach((_, id) => {
      if (!currentIds.has(id)) {
        messageRefs.current.delete(id);
      }
    });
  }, [enrichedMessages]);

  const getViewport = useCallback((): HTMLElement | null => {
    const root = scrollRootRef.current;
    if (!root) return null;
    return root.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");
  }, []);

  const handleLoadOlder = useCallback(() => {
    if (!onLoadOlderMessages || isLoadingOlderMessages || !hasMoreMessages) return;
    const viewport = getViewport();
    if (viewport) {
      pendingRestoreRef.current = { scrollHeight: viewport.scrollHeight, scrollTop: viewport.scrollTop };
    }
    onLoadOlderMessages();
  }, [onLoadOlderMessages, isLoadingOlderMessages, hasMoreMessages, getViewport]);

  // Carrega automaticamente ao chegar no topo da conversa.
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const viewport = getViewport();
    if (!sentinel || !viewport || !hasMoreMessages) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Enquanto a conversa ainda está se ajustando ao fim, ignorar o topo:
        // carregar histórico aqui é o que fazia a conversa abrir no meio.
        if (Date.now() < pinBottomUntilRef.current) return;
        if (entries.some((e) => e.isIntersecting)) handleLoadOlder();
      },
      { root: viewport, rootMargin: "120px 0px 0px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreMessages, handleLoadOlder, getViewport]);

  const scrollToBottom = useCallback(() => {
    const viewport = getViewport();
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
  }, [getViewport]);

  // Troca de conversa: reseta âncoras e prende no fim enquanto o layout
  // (mídias, áudios) ainda muda de altura. Rodar antes do efeito de scroll
  // garante que a primeira leva de mensagens nunca seja tratada como
  // "histórico carregado no topo".
  useLayoutEffect(() => {
    conversationKeyRef.current = conversationId;
    firstMessageIdRef.current = null;
    pendingRestoreRef.current = null;
    pinBottomUntilRef.current = Date.now() + 1500;
    const viewport = getViewport();
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [conversationId, getViewport]);

  // Auto-scroll to bottom when messages change (exceto ao carregar histórico antigo)
  useLayoutEffect(() => {
    if (enrichedMessages.length === 0) {
      firstMessageIdRef.current = null;
      return;
    }

    const newFirstId = enrichedMessages[0].id;
    const prepended =
      firstMessageIdRef.current !== null &&
      firstMessageIdRef.current !== newFirstId;
    firstMessageIdRef.current = newFirstId;

    if (prepended && pendingRestoreRef.current) {
      const viewport = getViewport();
      const saved = pendingRestoreRef.current;
      pendingRestoreRef.current = null;
      if (viewport) {
        viewport.scrollTop = saved.scrollTop + (viewport.scrollHeight - saved.scrollHeight);
        return;
      }
    }

    if (prepended) return;

    scrollToBottom();
  }, [enrichedMessages, getViewport, scrollToBottom]);

  // Enquanto a janela de "grudar no fim" estiver ativa, qualquer mudança de
  // altura (mídia carregando, áudio medindo duração) reancora no fim.
  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      if (Date.now() < pinBottomUntilRef.current) scrollToBottom();
    });
    observer.observe(viewport);
    const content = viewport.firstElementChild;
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, [getViewport, scrollToBottom, enrichedMessages.length]);


  // Scroll to search focus
  useEffect(() => {
    if (searchFocusId) {
      const element = messageRefs.current.get(searchFocusId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedMessageId(searchFocusId);
        const timer = setTimeout(() => setHighlightedMessageId(null), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [searchFocusId]);

  // Build search match set for fast lookup
  const searchMatchSet = useMemo(() => new Set(searchMatchIds || []), [searchMatchIds]);

  return (
    <ScrollArea ref={scrollRootRef} className="flex-1 px-2 sm:px-4 py-2">
      <div className="space-y-1 w-full min-w-0">
        <div ref={topSentinelRef} />
        {enrichedMessages.length > 0 && (hasMoreMessages || isLoadingOlderMessages) && (
          <div className="flex justify-center py-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-zapp-text-muted"
              disabled={isLoadingOlderMessages}
              onClick={handleLoadOlder}
            >
              {isLoadingOlderMessages ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Carregando histórico...
                </>
              ) : (
                <>
                  <ArrowUp className="h-3.5 w-3.5 mr-1.5" />
                  Carregar mensagens anteriores
                </>
              )}
            </Button>
          </div>
        )}
        {enrichedMessages.length > 0 && !hasMoreMessages && !isLoadingOlderMessages && (
          <p className="text-center text-[11px] text-zapp-text-muted py-2">Início da conversa</p>
        )}
        {enrichedMessages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-8 w-8 text-zapp-text-muted mx-auto mb-2" />
            <p className="text-zapp-text-muted text-sm">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          enrichedMessages.map((message, index) => {
            const showTimestamp = index === 0 ||
              new Date(message.created_at).toDateString() !== new Date(enrichedMessages[index - 1].created_at).toDateString();

            return (
              <div
                key={message.id}
                ref={(el) => {
                  if (el) messageRefs.current.set(message.id, el);
                }}
              >
                <ZappMessageBubble
                  message={message}
                  showTimestamp={showTimestamp}
                  isGroup={isGroup}
                  onReply={onReplyMessage}
                  onDelete={onDeleteMessage}
                  onEdit={onEditMessage}
                  onRetry={onRetryMessage}
                  onRetryMediaDownload={onRetryMediaDownload}
                  onScrollToQuoted={handleScrollToQuoted}
                  isHighlighted={highlightedMessageId === message.id}
                  searchHighlight={searchMatchSet.has(message.id)}
                />
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
