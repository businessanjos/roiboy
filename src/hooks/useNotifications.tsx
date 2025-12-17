import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
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
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => Promise<void>;
  requestNotificationPermission: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

// Check if browser supports notifications
const supportsNotifications = () => "Notification" in window;

// Show browser push notification
const showBrowserNotification = (title: string, body: string, link?: string | null) => {
  if (!supportsNotifications() || Notification.permission !== "granted") return;

  const notification = new Notification(title, {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: `roiboy-${Date.now()}`, // Unique tag to allow multiple notifications
  });

  if (link) {
    notification.onclick = () => {
      window.focus();
      window.location.href = link;
      notification.close();
    };
  }

  // Auto close after 5 seconds
  setTimeout(() => notification.close(), 5000);
};

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
        toast.success("Notificações ativadas!");
      } else if (permission === "denied") {
        toast.error("Permissão de notificações negada");
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .single();

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

    // Real-time subscription
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
          
          // Check if this notification is for current user
          if (newNotification.user_id === currentUserId) {
            // Fetch the complete notification with user data
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
              
              // Show toast notification (in-app)
              toast.info(data.title, {
                description: data.content || undefined,
                action: data.link ? {
                  label: "Ver",
                  onClick: () => window.location.href = data.link!,
                } : undefined,
              });

              // Show browser push notification
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
