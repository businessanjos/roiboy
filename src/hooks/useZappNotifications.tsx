import { useCallback, useRef } from "react";
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
    
    // Play appropriate sound
    playNotificationSound(isQueue);
    
    // Show toast notification
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
  }, [shouldNotify, isQueueMessage, playNotificationSound, onViewChat]);

  return {
    notifyNewMessage,
    playNotificationSound,
    isQueueMessage,
  };
}
