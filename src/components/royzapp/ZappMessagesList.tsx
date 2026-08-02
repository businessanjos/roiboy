import { useRef, useLayoutEffect, useMemo, useState, useCallback, useEffect } from "react";
import { MessageSquare, Loader2, ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Message } from "@/hooks/useZappData";
import { ZappMessageBubble } from "./ZappMessageBubble";

/** Quantas mensagens são montadas por vez (janela local de renderização). */
const WINDOW_STEP = 40;



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
  const viewportRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  // Guarda a altura do scroll antes de carregar histórico, para manter a
  // posição visual quando mensagens antigas são inseridas no topo.
  const pendingRestoreRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const firstMessageIdRef = useRef<string | null>(null);
  // Janela de "grudar no fim" enquanto mídias/áudios ainda mudam a altura
  // logo após abrir a conversa.
  const pinBottomUntilRef = useRef<number>(0);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Deduplicate messages to prevent visual duplicates from race conditions
  // Priority: real messages over temp, dedupe by external_message_id when available
  // Special handling for audio messages which can have duplicate records with different content
  const deduplicatedMessages = useMemo(() => {
    const seen = new Set<string>();
    const result: Message[] = [];

    // Group outbound audio messages by approximate time (30-second buckets)
    const audioTimeMap = new Map<string, Message[]>();
    let hasTemp = false;

    for (const msg of messages) {
      if (msg.id.startsWith("temp-")) hasTemp = true;
      if (msg.message_type === "audio" && !msg.is_from_client) {
        const timeKey = String(Math.floor(new Date(msg.created_at).getTime() / 30000));
        const bucket = audioTimeMap.get(timeKey);
        if (bucket) bucket.push(msg);
        else audioTimeMap.set(timeKey, [msg]);
      }
    }

    // For each time bucket with multiple audios, prefer the one with external_message_id and duration
    const duplicateAudioIds = new Set<string>();
    for (const audioMsgs of audioTimeMap.values()) {
      if (audioMsgs.length > 1) {
        audioMsgs.sort((a, b) => {
          if (!a.id.startsWith("temp-") && b.id.startsWith("temp-")) return -1;
          if (a.id.startsWith("temp-") && !b.id.startsWith("temp-")) return 1;
          if (a.external_message_id && !b.external_message_id) return -1;
          if (!a.external_message_id && b.external_message_id) return 1;
          if ((a.audio_duration_sec || 0) > (b.audio_duration_sec || 0)) return -1;
          if ((a.audio_duration_sec || 0) < (b.audio_duration_sec || 0)) return 1;
          return 0;
        });
        for (let i = 1; i < audioMsgs.length; i++) duplicateAudioIds.add(audioMsgs[i].id);
      }
    }

    // Só monta a lista de áudios reais quando existe alguma mensagem temporária
    const realAudioTimes = hasTemp
      ? messages
          .filter((m) => !m.id.startsWith("temp-") && m.message_type === "audio" && m.is_from_client === false)
          .map((m) => new Date(m.created_at).getTime())
      : [];

    for (const msg of messages) {
      if (duplicateAudioIds.has(msg.id)) continue;

      // Skip temporary messages if a real version exists (30s window)
      if (msg.id.startsWith("temp-")) {
        const ts = new Date(msg.created_at).getTime();
        if (realAudioTimes.some((t) => Math.abs(t - ts) < 30000)) continue;
      }

      const dedupeKey = msg.external_message_id || msg.id;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        result.push(msg);
      }
    }

    return result;
  }, [messages]);

  // Build fallback mention map from sender_phone data for groups
  const combinedMentionMap = useMemo(() => {
    if (!isGroup) return {};
    return buildFallbackMentionMap(deduplicatedMessages);
  }, [isGroup, deduplicatedMessages]);

  // Build a lookup map by external_message_id for quoted content resolution
  const messagesByExternalId = useMemo(() => {
    const map = new Map<string, Message>();
    for (const msg of deduplicatedMessages) {
      if (msg.external_message_id) map.set(msg.external_message_id, msg);
    }
    return map;
  }, [deduplicatedMessages]);

  // Enrich messages: merge mention names + fill missing quoted content from loaded messages
  const enrichedMessages = useMemo(() => {
    const mentionRegex = /@\d{5,}/;
    return deduplicatedMessages.map((msg) => {
      let enriched = msg;

      // Fill missing quoted_content by looking up the original message
      if (msg.quoted_message_id && !msg.quoted_content) {
        const originalMsg = messagesByExternalId.get(msg.quoted_message_id);
        if (originalMsg) {
          const resolvedContent =
            originalMsg.content ||
            (originalMsg.message_type === "image"
              ? "📷 Imagem"
              : originalMsg.message_type === "video"
                ? "🎬 Vídeo"
                : originalMsg.message_type === "audio"
                  ? "🎤 Áudio"
                  : originalMsg.message_type === "document"
                    ? "📄 Documento"
                    : originalMsg.message_type === "sticker"
                      ? "🎨 Figurinha"
                      : null);
          const resolvedSender =
            msg.quoted_sender_name || originalMsg.sender_name || (originalMsg.is_from_client ? "Cliente" : "Você");
          enriched = { ...enriched, quoted_content: resolvedContent, quoted_sender_name: resolvedSender };
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

  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    enrichedMessages.forEach((m, i) => {
      map.set(m.id, i);
      if (m.external_message_id) {
        if (!map.has(m.external_message_id)) map.set(m.external_message_id, i);
      }
    });
    return map;
  }, [enrichedMessages]);

  // ---- Virtualização (padrão validado no zApp da RYKA) ----
  const rowVirtualizer = useVirtualizer({
    count: enrichedMessages.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: (i) => {
      const m = enrichedMessages[i];
      if (!m) return 72;
      const t = m.message_type;
      if (t === "image" || t === "video" || t === "sticker") return 260;
      if (t === "document") return 110;
      if (t === "audio" || t === "ptt") return 84;
      if (m.quoted_message_id) return 128;
      return 64;
    },
    overscan: 8,
    getItemKey: (i) => enrichedMessages[i]?.id ?? i,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();


  const atBottomRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
    atBottomRef.current = true;
  }, []);

  // Observa a posição do usuário e cancela a "pinagem" no fim assim que ele
  // interage com a rolagem — evita o chat pulando enquanto se rola.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onScroll = () => {
      atBottomRef.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 80;
    };
    const onUserIntent = () => {
      pinBottomUntilRef.current = 0;
      onScroll();
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    viewport.addEventListener("wheel", onUserIntent, { passive: true });
    viewport.addEventListener("touchstart", onUserIntent, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      viewport.removeEventListener("wheel", onUserIntent);
      viewport.removeEventListener("touchstart", onUserIntent);
    };
  }, [conversationId]);

  const saveScrollAnchor = useCallback(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      pendingRestoreRef.current = { scrollHeight: viewport.scrollHeight, scrollTop: viewport.scrollTop };
    }
  }, []);


  const scrollToMessage = useCallback(
    (messageId: string) => {
      const index = indexById.get(messageId);
      if (index === undefined) return;
      const ensureVisible = () => {
        const el = viewportRef.current?.querySelector<HTMLElement>(`[data-msg-id="${CSS.escape(messageId)}"]`);
        el?.scrollIntoView({ block: "center" });
      };
      if (index < Math.max(0, enrichedMessages.length - windowSize)) {
        setWindowSize(enrichedMessages.length - index + WINDOW_STEP);
        requestAnimationFrame(ensureVisible);
      } else {
        ensureVisible();
      }
    },
    [indexById, enrichedMessages.length, windowSize]
  );

  // Scroll to quoted message handler
  const handleScrollToQuoted = useCallback(
    (quotedMessageId: string) => {
      const target = enrichedMessages[indexById.get(quotedMessageId) ?? -1];
      if (!target) return;
      scrollToMessage(target.id);
      setHighlightedMessageId(target.id);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    },
    [indexById, enrichedMessages, scrollToMessage]
  );

  const handleLoadOlder = useCallback(() => {
    // Evita expansões em cascata antes de restaurar a posição da anterior.
    if (pendingRestoreRef.current) return;
    // Primeiro expande a janela local; só busca no servidor quando tudo já está renderizado.
    if (windowStart > 0) {
      saveScrollAnchor();
      setWindowSize((s) => s + WINDOW_STEP);
      return;
    }

    if (!onLoadOlderMessages || isLoadingOlderMessages || !hasMoreMessages) return;
    saveScrollAnchor();
    onLoadOlderMessages();
  }, [windowStart, saveScrollAnchor, onLoadOlderMessages, isLoadingOlderMessages, hasMoreMessages]);


  // Carrega automaticamente ao chegar no topo da conversa.
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const viewport = viewportRef.current;
    if (!sentinel || !viewport || (!hasMoreMessages && windowStart === 0)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Enquanto a conversa ainda está se ajustando ao fim, ignorar o topo.
        if (Date.now() < pinBottomUntilRef.current) return;
        if (entries.some((e) => e.isIntersecting)) handleLoadOlder();
      },
      { root: viewport, rootMargin: "160px 0px 0px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreMessages, windowStart, handleLoadOlder]);

  // Troca de conversa: reseta âncoras e prende no fim enquanto o layout
  // (mídias, áudios) ainda muda de altura.
  useLayoutEffect(() => {
    firstMessageIdRef.current = null;
    pendingRestoreRef.current = null;
    pinBottomUntilRef.current = Date.now() + 2500;
    scrollToBottom();
  }, [conversationId, scrollToBottom]);

  // Auto-scroll to bottom when messages change (exceto ao carregar histórico antigo)
  useLayoutEffect(() => {
    if (enrichedMessages.length === 0) {
      firstMessageIdRef.current = null;
      return;
    }

    const newFirstId = enrichedMessages[0].id;
    const prepended = firstMessageIdRef.current !== null && firstMessageIdRef.current !== newFirstId;
    firstMessageIdRef.current = newFirstId;

    if (prepended) {
      const saved = pendingRestoreRef.current;
      pendingRestoreRef.current = null;
      const viewport = viewportRef.current;
      if (saved && viewport) {
        viewport.scrollTop = saved.scrollTop + (viewport.scrollHeight - saved.scrollHeight);
      }
      return;
    }

    // Só acompanha o fim se o usuário já estava no fim (ou logo após abrir).
    if (atBottomRef.current || Date.now() < pinBottomUntilRef.current) scrollToBottom();
  }, [enrichedMessages, scrollToBottom]);

  // Reancora no fim quando a altura muda (mídia carregando, painel de sugestões
  // abrindo, teclado) — apenas se o usuário estiver no fim ou na janela de "pin".
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let raf = 0;
    const observer = new ResizeObserver(() => {
      if (Date.now() >= pinBottomUntilRef.current && !atBottomRef.current) return;
      if (pendingRestoreRef.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(scrollToBottom);
    });
    observer.observe(viewport);
    const content = viewport.firstElementChild;
    if (content) observer.observe(content);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [scrollToBottom]);



  // Restaurar posição ao expandir a janela local de mensagens
  useLayoutEffect(() => {
    const saved = pendingRestoreRef.current;
    const viewport = viewportRef.current;
    if (saved && viewport) {
      pendingRestoreRef.current = null;
      viewport.scrollTop = saved.scrollTop + (viewport.scrollHeight - saved.scrollHeight);
    }
  }, [windowSize]);


  // Scroll to search focus
  useEffect(() => {
    if (!searchFocusId) return;
    if (indexById.get(searchFocusId) === undefined) return;
    scrollToMessage(searchFocusId);
    setHighlightedMessageId(searchFocusId);
    const timer = setTimeout(() => setHighlightedMessageId(null), 2000);
    return () => clearTimeout(timer);
  }, [searchFocusId, indexById, scrollToMessage]);

  // Build search match set for fast lookup
  const searchMatchSet = useMemo(() => new Set(searchMatchIds || []), [searchMatchIds]);

  // ---- Callbacks estáveis para as bolhas (evita re-render de toda a lista) ----
  const callbacksRef = useRef({ onReplyMessage, onEditMessage, onRetryMessage, onRetryMediaDownload, onDeleteMessage });
  callbacksRef.current = { onReplyMessage, onEditMessage, onRetryMessage, onRetryMediaDownload, onDeleteMessage };

  const stableReply = useCallback((message: Message) => callbacksRef.current.onReplyMessage?.(message), []);
  const stableEdit = useCallback(
    (id: string, content: string) => callbacksRef.current.onEditMessage?.(id, content) ?? Promise.resolve(),
    []
  );
  const stableRetry = useCallback((message: Message) => callbacksRef.current.onRetryMessage?.(message), []);
  const stableRetryMedia = useCallback((id: string) => callbacksRef.current.onRetryMediaDownload?.(id), []);
  const stableRequestDelete = useCallback((id: string) => setPendingDeleteId(id), []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return;
    setIsDeleting(true);
    try {
      await callbacksRef.current.onDeleteMessage?.(pendingDeleteId);
    } finally {
      setIsDeleting(false);
      setPendingDeleteId(null);
    }
  }, [pendingDeleteId]);

  return (
    <>
      <div
        ref={viewportRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-2 sm:px-4 py-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
      >
        <div ref={topSentinelRef} />
        {enrichedMessages.length > 0 && (hasMoreMessages || isLoadingOlderMessages || windowStart > 0) && (
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
        {enrichedMessages.length > 0 && !hasMoreMessages && !isLoadingOlderMessages && windowStart === 0 && (
          <p className="text-center text-[11px] text-zapp-text-muted py-2">Início da conversa</p>
        )}

        {enrichedMessages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-8 w-8 text-zapp-text-muted mx-auto mb-2" />
            <p className="text-zapp-text-muted text-sm">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          <div className="w-full min-w-0">
            {visibleMessages.map((message, i) => {
              const prev = i === 0 ? enrichedMessages[windowStart - 1] : visibleMessages[i - 1];
              const showTimestamp =
                !prev ||
                new Date(message.created_at).toDateString() !== new Date(prev.created_at).toDateString();

              return (
                <div key={message.id} data-msg-id={message.id} className="w-full min-w-0">
                  <ZappMessageBubble
                    message={message}
                    showTimestamp={!!showTimestamp}
                    isGroup={isGroup}
                    onReply={onReplyMessage ? stableReply : undefined}
                    onDelete={onDeleteMessage ? stableRequestDelete : undefined}
                    onEdit={onEditMessage ? stableEdit : undefined}
                    onRetry={onRetryMessage ? stableRetry : undefined}
                    onRetryMediaDownload={onRetryMediaDownload ? stableRetryMedia : undefined}
                    onScrollToQuoted={handleScrollToQuoted}
                    isHighlighted={highlightedMessageId === message.id}
                    searchHighlight={searchMatchSet.has(message.id)}
                  />
                </div>
              );
            })}
          </div>
        )}

      </div>

      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar mensagem para todos?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta mensagem será apagada para você e para todos os participantes da conversa. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Apagando...
                </>
              ) : (
                "Apagar para todos"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
