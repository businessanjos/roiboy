import { useCallback, useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { ZappNotificationToast } from "@/components/royzapp/ZappNotificationToast";

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
  onViewChat: (conversationId: string) => void;
}

export type NotificationPermissionStatus = "granted" | "denied" | "default" | "unsupported";

export function useZappNotifications({
  soundEnabled,
  currentAgentId,
  selectedConversationId,
  onViewChat,
}: UseZappNotificationsOptions) {
  // Track last notification to prevent rapid duplicates
  const lastNotificationRef = useRef<{ conversationId: string; timestamp: number } | null>(null);
  
  // Audio refs for preloading
  const popAudioRef = useRef<HTMLAudioElement | null>(null);
  const dingAudioRef = useRef<HTMLAudioElement | null>(null);

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

  // Preload audio files
  const getPopAudio = useCallback(() => {
    if (!popAudioRef.current) {
      popAudioRef.current = new Audio("/sounds/notification-pop.mp3");
      popAudioRef.current.volume = 0.5;
    }
    return popAudioRef.current;
  }, []);

  const getDingAudio = useCallback(() => {
    if (!dingAudioRef.current) {
      dingAudioRef.current = new Audio("/sounds/notification-ding.mp3");
      dingAudioRef.current.volume = 0.6;
    }
    return dingAudioRef.current;
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback((isQueue: boolean) => {
    if (!soundEnabled) return;
    
    try {
      const audio = isQueue ? getDingAudio() : getPopAudio();
      // Reset audio to start if already playing
      audio.currentTime = 0;
      audio.play().catch((err) => {
        // Ignore autoplay errors - browser may block until user interaction
        console.log("[Notifications] Audio play blocked:", err.message);
      });
    } catch (error) {
      console.error("[Notifications] Error playing sound:", error);
    }
  }, [soundEnabled, getPopAudio, getDingAudio]);

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
  }, [selectedConversationId]);

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
