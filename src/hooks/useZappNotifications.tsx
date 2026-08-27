import { useCallback, useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { ZappNotificationToast } from "@/components/royzapp/ZappNotificationToast";
import { supabase } from "@/integrations/supabase/client";

interface NotificationData {
  conversationId: string;
  contactName: string;
  messagePreview: string;
  avatarUrl?: string | null;
  agentId?: string | null; // null = Fila
  isGroup?: boolean;
}

interface UseZappNotificationsOptions {
  soundEnabled: boolean;
  currentAgentId?: string;
  selectedConversationId?: string | null;
  /** Setor atual (slug: operacoes, vendas, ...) para respeitar o filtro de setores das preferências */
  sectorId?: string | null;
  onViewChat: (conversationId: string) => void;
}

export type NotificationPermissionStatus = "granted" | "denied" | "default" | "unsupported";

export function useZappNotifications({
  soundEnabled,
  currentAgentId,
  selectedConversationId,
  sectorId,
  onViewChat,
}: UseZappNotificationsOptions) {
  // Track last notification to prevent rapid duplicates
  const lastNotificationRef = useRef<{ conversationId: string; timestamp: number } | null>(null);

  // Preferências de notificação definidas pelo usuário (Notificações > Preferências)
  const prefsRef = useRef<{ zappEnabled: boolean; sectors: string[] }>({
    zappEnabled: true,
    sectors: [],
  });

  const loadPreferences = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUserId = authData.user?.id;
      if (!authUserId) return;

      const { data: userRow } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      if (!userRow?.id) return;

      const { data } = await supabase
        .from("push_notification_preferences" as any)
        .select("notify_zapp_messages, notify_sectors")
        .eq("user_id", userRow.id)
        .maybeSingle();

      if (data) {
        const rawSectors = (data as any).notify_sectors;
        prefsRef.current = {
          zappEnabled: (data as any).notify_zapp_messages !== false,
          sectors: Array.isArray(rawSectors) ? rawSectors : [],
        };
      } else {
        prefsRef.current = { zappEnabled: true, sectors: [] };
      }
    } catch (error) {
      console.error("[Notifications] Erro ao carregar preferências:", error);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
    const onFocus = () => {
      if (!document.hidden) loadPreferences();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [loadPreferences]);

  



  // System notification permission state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionStatus>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    return Notification.permission as NotificationPermissionStatus;
  });

  // Re-verify permission when tab regains focus
  // This captures changes made by the user in browser settings
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    
    // Check immediately
    setNotificationPermission(Notification.permission as NotificationPermissionStatus);
    
    // Re-check when tab regains focus (user may have changed in settings)
    const handleVisibilityChange = () => {
      if (!document.hidden && "Notification" in window) {
        setNotificationPermission(Notification.permission as NotificationPermissionStatus);
      }
    };
    
    // Re-check when window gains focus
    const handleFocus = () => {
      if ("Notification" in window) {
        setNotificationPermission(Notification.permission as NotificationPermissionStatus);
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async (): Promise<NotificationPermissionStatus> => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission as NotificationPermissionStatus);
      return permission as NotificationPermissionStatus;
    } catch (error) {
      console.error("[Notifications] Error requesting permission:", error);
      return "denied";
    }
  }, []);

  // Check if tab is visible
  const isTabVisible = useCallback((): boolean => {
    if (typeof document === "undefined") return true;
    return !document.hidden;
  }, []);

  // Web Audio: os arquivos mp3 estáticos estavam corrompidos (continham apenas
  // uma data-URI em texto), então sintetizamos o som localmente.
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new Ctor();
      } catch {
        return null;
      }
    }
    return audioCtxRef.current;
  }, []);

  // Desbloqueia o contexto de áudio no primeiro gesto do usuário
  useEffect(() => {
    const unlock = () => {
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [getAudioContext]);

  // Play notification sound
  const playNotificationSound = useCallback((isQueue: boolean) => {
    if (!soundEnabled) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    const start = () => {
      const now = ctx.currentTime;
      // Fila = dois toques ("ding"); Minhas = um toque curto ("pop")
      const notes = isQueue
        ? [{ freq: 880, at: 0, dur: 0.16 }, { freq: 1320, at: 0.18, dur: 0.22 }]
        : [{ freq: 1046, at: 0, dur: 0.12 }];

      notes.forEach(({ freq, at, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + at);
        gain.gain.setValueAtTime(0.0001, now + at);
        gain.gain.exponentialRampToValueAtTime(0.25, now + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + at);
        osc.stop(now + at + dur + 0.02);
      });
    };

    try {
      if (ctx.state === "suspended") {
        ctx.resume().then(start).catch(() => {});
      } else {
        start();
      }
    } catch (error) {
      console.error("[Notifications] Error playing sound:", error);
    }
  }, [soundEnabled, getAudioContext]);


  // Show system notification (Web Notifications API)
  const showSystemNotification = useCallback((
    title: string, 
    body: string, 
    data: { conversationId: string; avatarUrl?: string | null; isGroup?: boolean }
  ) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    
    try {
      const notification = new Notification(title, {
        body,
        icon: data.avatarUrl || "/favicon.ico",
        badge: "/favicon.ico",
        tag: `zapp-${data.conversationId}`, // Groups notifications from same chat
        requireInteraction: false, // Auto-closes
        silent: true, // We handle sound separately
      });
      
      notification.onclick = () => {
        // Focus the window and navigate to chat
        window.focus();
        onViewChat(data.conversationId);
        notification.close();
      };
      
      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error("[Notifications] Error showing system notification:", error);
    }
  }, [onViewChat]);

  // Determine if message is from "Minhas" or "Fila"
  const isQueueMessage = useCallback((agentId: string | null | undefined): boolean => {
    // Message is from queue if:
    // 1. No agent assigned (null)
    // 2. Agent is different from current user
    if (!agentId) return true;
    if (!currentAgentId) return true;
    return agentId !== currentAgentId;
  }, [currentAgentId]);

  // Check if we should notify for this conversation
  const shouldNotify = useCallback((conversationId: string): boolean => {
    // Respeita as preferências do usuário: categoria "Novas mensagens (zAPP)"
    if (!prefsRef.current.zappEnabled) return false;

    // Respeita o filtro de setores das preferências (quando houver seleção)
    const prefSectors = prefsRef.current.sectors;
    if (sectorId && prefSectors.length > 0 && !prefSectors.includes(sectorId)) {
      return false;
    }

    // Don't notify if this is the currently selected conversation
    if (selectedConversationId === conversationId) {
      return false;
    }

    
    // Rate limit: don't notify same conversation within 2 seconds
    const now = Date.now();
    if (
      lastNotificationRef.current?.conversationId === conversationId &&
      now - lastNotificationRef.current.timestamp < 2000
    ) {
      return false;
    }
    
    return true;
  }, [selectedConversationId, sectorId]);

  // Show notification for new message
  const notifyNewMessage = useCallback((data: NotificationData) => {
    const { conversationId, contactName, messagePreview, avatarUrl, agentId, isGroup } = data;
    
    // Check if we should notify
    if (!shouldNotify(conversationId)) {
      return;
    }
    
    // Update last notification tracking
    lastNotificationRef.current = {
      conversationId,
      timestamp: Date.now(),
    };
    
    // Determine origin
    const isQueue = isQueueMessage(agentId);
    
    // Always play sound (works in background on most browsers)
    playNotificationSound(isQueue);
    
    // Choose notification method based on tab visibility
    if (isTabVisible()) {
      // Tab is active - show custom toast notification
      toast.custom(
        (t) => (
          <ZappNotificationToast
            contactName={contactName}
            messagePreview={messagePreview}
            avatarUrl={avatarUrl}
            origin={isQueue ? "queue" : "mine"}
            isGroup={isGroup}
            onViewChat={() => {
              toast.dismiss(t);
              onViewChat(conversationId);
            }}
            onDismiss={() => toast.dismiss(t)}
          />
        ),
        {
          duration: 5000,
          position: "top-right",
        }
      );
    } else {
      // Tab is in background - show system push notification
      const title = `Nova mensagem${isQueue ? " (Fila)" : ""}`;
      const body = `${contactName}: "${messagePreview.length > 80 ? messagePreview.substring(0, 80) + "..." : messagePreview}"`;
      
      showSystemNotification(title, body, { conversationId, avatarUrl, isGroup });
    }
  }, [shouldNotify, isQueueMessage, playNotificationSound, isTabVisible, showSystemNotification, onViewChat]);

  return {
    notifyNewMessage,
    playNotificationSound,
    isQueueMessage,
    // System notification support
    notificationPermission,
    requestNotificationPermission,
    isSystemNotificationSupported: typeof window !== "undefined" && "Notification" in window,
  };
}
