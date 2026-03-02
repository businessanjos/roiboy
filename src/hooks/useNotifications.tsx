import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  content: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
  source_type: string | null;
  source_id: string | null;
  triggered_by_user_id: string | null;
  triggered_by_user?: {
    name: string;
    avatar_url: string | null;
  };
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  notificationPermission: NotificationPermission | "unsupported";
  pushSubscribed: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => Promise<void>;
  requestNotificationPermission: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

const supportsNotifications = () => "Notification" in window;
const supportsPush = () => "PushManager" in window && "serviceWorker" in navigator;

// Register service worker and subscribe to push
async function subscribeToPush(): Promise<boolean> {
  if (!supportsPush()) return false;

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // Get VAPID public key from server
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    const vapidResponse = await fetch(
      `https://${projectId}.supabase.co/functions/v1/push-subscribe`,
      {
        method: "GET",
        headers: { "apikey": anonKey },
      }
    );

    if (!vapidResponse.ok) {
      console.error("Failed to get VAPID key");
      return false;
    }

    const { publicKey } = await vapidResponse.json();

    // Convert base64url to Uint8Array for applicationServerKey
    const urlBase64 = publicKey.replace(/-/g, "+").replace(/_/g, "/");
    const pad = urlBase64.length % 4 === 0 ? "" : "=".repeat(4 - (urlBase64.length % 4));
    const raw = atob(urlBase64 + pad);
    const applicationServerKey = Uint8Array.from(raw, (c) => c.charCodeAt(0));

    // Subscribe to push
    const pm = (registration as any).pushManager;
    let subscription = await pm.getSubscription();

    if (!subscription) {
      subscription = await pm.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    // Send subscription to server
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) return false;

    const saveResponse = await fetch(
      `https://${projectId}.supabase.co/functions/v1/push-subscribe`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "apikey": anonKey,
        },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      }
    );

    return saveResponse.ok;
  } catch (error) {
    console.error("Push subscription error:", error);
    return false;
  }
}

// Show browser notification (fallback for when SW is not available)
const showBrowserNotification = (title: string, body: string, link?: string | null) => {
  if (!supportsNotifications() || Notification.permission !== "granted") return;

  const notification = new Notification(title, {
    body,
    icon: "/roy-logo.png",
    badge: "/roy-logo.png",
    tag: `roy-${Date.now()}`,
  });

  if (link) {
    notification.onclick = () => {
      window.focus();
      window.location.href = link;
      notification.close();
    };
  }

  setTimeout(() => notification.close(), 5000);
};

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const pushSubscribeAttempted = useRef(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    supportsNotifications() ? Notification.permission : "unsupported"
  );

  const requestNotificationPermission = useCallback(async () => {
    if (!supportsNotifications()) {
      setNotificationPermission("unsupported");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === "granted") {
        // Try to subscribe to push after permission granted
        const subscribed = await subscribeToPush();
        setPushSubscribed(subscribed);
        
        if (subscribed) {
          toast.success("Notificações push ativadas! Você receberá notificações mesmo com a tela bloqueada.");
        } else {
          toast.success("Notificações ativadas!");
        }
      } else if (permission === "denied") {
        toast.error("Permissão de notificações negada. Vá em Configurações do navegador para reativar.");
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
  }, []);

  // Auto-subscribe to push if permission is already granted
  useEffect(() => {
    if (
      notificationPermission === "granted" &&
      supportsPush() &&
      currentUserId &&
      !pushSubscribeAttempted.current
    ) {
      pushSubscribeAttempted.current = true;
      subscribeToPush().then((subscribed) => {
        setPushSubscribed(subscribed);
      });
    }
  }, [notificationPermission, currentUserId]);

  const fetchNotifications = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();

      if (!userData) return;
      setCurrentUserId(userData.id);

      const { data, error } = await supabase
        .from("notifications")
        .select(`
          *,
          triggered_by_user:users!notifications_triggered_by_user_id_fkey(name, avatar_url)
        `)
        .eq("user_id", userData.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        async (payload) => {
          const newNotification = payload.new as Notification;

          if (newNotification.user_id === currentUserId) {
            const { data } = await supabase
              .from("notifications")
              .select(`
                *,
                triggered_by_user:users!notifications_triggered_by_user_id_fkey(name, avatar_url)
              `)
              .eq("id", newNotification.id)
              .single();

            if (data) {
              setNotifications((prev) => [data, ...prev]);

              toast.info(data.title, {
                description: data.content || undefined,
                action: data.link
                  ? {
                      label: "Ver",
                      onClick: () => (window.location.href = data.link!),
                    }
                  : undefined,
              });

              // Send push notification via edge function (server-side)
              // This ensures it works even when the app is in the background
              try {
                const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
                const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
                
                await fetch(
                  `https://${projectId}.supabase.co/functions/v1/send-push`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "apikey": anonKey,
                    },
                    body: JSON.stringify({
                      user_id: data.user_id,
                      title: data.title,
                      body: data.content || "Nova notificação",
                      url: data.link || "/notifications",
                      tag: `notification-${data.id}`,
                    }),
                  }
                );
              } catch (pushError) {
                console.error("Error sending push:", pushError);
              }

              // Fallback: show browser notification directly
              showBrowserNotification(
                data.title,
                data.content || "Nova notificação",
                data.link
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);

      if (error) throw error;
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", unreadIds);

      if (error) throw error;
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        notificationPermission,
        pushSubscribed,
        markAsRead,
        markAllAsRead,
        refetch: fetchNotifications,
        requestNotificationPermission,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return context;
}
