import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  notificationTabCountsKey,
  optimisticallyMarkReadInHistoryCache,
  optimisticallyMarkAllReadInHistoryCache,
  decrementTabCounts,
  invalidateNotificationsQueries,
  findRowInHistoryCache,
  type NotificationTabCounts,
} from "@/hooks/useNotificationsHistory";

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
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const pushSubscribeAttempted = useRef(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    supportsNotifications() ? Notification.permission : "unsupported"
  );
  // Ids cuja transição não-lida -> lida já foi contabilizada (localmente ou via
  // realtime), usado para dedupe entre o update otimista de markAsRead e o
  // evento realtime UPDATE que ecoa a própria mudança — evita decrementar
  // unreadCount/tabCounts duas vezes para a mesma leitura.
  const readAccountedRef = useRef<Set<string>>(new Set());

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

  // Contagem de não lidas no servidor (count head:true), independente do resumo carregado abaixo.
  const fetchUnreadCount = async (userId: string) => {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (!error) setUnreadCount(count ?? 0);
  };

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

      // Resumo recente (sino/dropdown) — não é o histórico completo; a página de Notificações
      // busca o conjunto completo com paginação no servidor.
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
      await fetchUnreadCount(userData.id);
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
          event: "UPDATE",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const updated = payload.new as Notification;
          if (updated.user_id !== currentUserId) return;

          // Mantém o resumo local em sincronia (ex.: marcado como lido em outra aba/dispositivo).
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? { ...n, is_read: updated.is_read } : n))
          );

          // Sino/unreadCount: só reage a transições PARA lida (is_read === true).
          // Dedupe com o update otimista do próprio markAsRead — se este id já foi
          // contabilizado localmente, o evento é apenas o eco do nosso próprio UPDATE
          // e não deve decrementar de novo. Caso contrário é uma leitura feita em
          // outro dispositivo/aba e o sino precisa refletir isso aqui.
          if (updated.is_read && !readAccountedRef.current.has(updated.id)) {
            readAccountedRef.current.add(updated.id);
            setUnreadCount((prev) => Math.max(0, prev - 1));
            decrementTabCounts(queryClient, currentUserId, updated.source_type ?? null);
          }

          // A página de histórico e as contagens por aba vivem no cache do react-query
          // e são a fonte de verdade para a tela de Notificações — invalida para refletir.
          invalidateNotificationsQueries(queryClient, currentUserId);
        }
      )
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
              setUnreadCount((prev) => prev + 1);

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

              invalidateNotificationsQueries(queryClient, currentUserId);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, queryClient]);

  // Marca como lida. A notificação clicada pode não estar nas 50 mais
  // recentes do resumo (ex.: aberta a partir da página de histórico/paginação),
  // então o source_type usado para decrementar a aba correta é obtido, nessa
  // ordem: (1) resumo local, (2) cache do histórico, (3) o retorno do próprio
  // UPDATE no servidor — nunca assumido como "Outros" por falta de dado local.
  //
  // A leitura real (e portanto o único decremento válido) é determinada pelo
  // servidor: o UPDATE só é aplicado com .eq('is_read', false), então um
  // segundo clique (ou uma notificação já lida em outro dispositivo) não
  // retorna linha e não decrementa de novo.
  const markAsRead = useCallback(
    async (id: string) => {
      if (readAccountedRef.current.has(id)) return; // já contabilizada localmente (clique duplo)

      const localTarget = notifications.find((n) => n.id === id);
      if (localTarget?.is_read) return;

      const cachedRow = findRowInHistoryCache(queryClient, id);
      if (cachedRow?.is_read && !localTarget) return; // já lida segundo o cache do histórico

      const knownSourceType = localTarget?.source_type ?? cachedRow?.source_type ?? null;

      // Reserva otimisticamente este id para evitar que um segundo clique
      // (antes do round-trip de rede concluir) decremente de novo.
      readAccountedRef.current.add(id);

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      optimisticallyMarkReadInHistoryCache(queryClient, id);
      decrementTabCounts(queryClient, currentUserId, knownSourceType);

      const rollback = () => {
        readAccountedRef.current.delete(id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: localTarget?.is_read ?? false } : n))
        );
        setUnreadCount((prev) => prev + 1);
        invalidateNotificationsQueries(queryClient, currentUserId);
      };

      try {
        // Só decrementa de fato se a linha "voltou" (leitura real, não repetida):
        // eq('is_read', false) garante que um clique numa notificação já lida
        // (localmente desconhecida, ex.: lida em outro dispositivo) não conta de novo.
        const { data, error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", id)
          .eq("is_read", false)
          .select("id, source_type")
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          // Não havia transição real a fazer: já estava lida no servidor.
          // Desfaz o decremento otimista (sem duplo decremento), mantendo is_read=true.
          readAccountedRef.current.delete(id);
          setUnreadCount((prev) => prev + 1);
          // reverte apenas a contagem (o estado "lido" já é o correto); revalida
          // do servidor para garantir que a aba certa volte ao valor real.
          invalidateNotificationsQueries(queryClient, currentUserId);
        } else if ((data.source_type ?? null) !== knownSourceType) {
          // O palpite de categoria (resumo/cache) divergiu do dado real do servidor:
          // corrige a contabilização sem invalidar tudo.
          invalidateNotificationsQueries(queryClient, currentUserId);
        } else {
          // Sucesso com categoria correta: revalida para refletir eventual
          // atividade concorrente (ex.: outra notificação lida nesse meio tempo).
          queryClient.invalidateQueries({ queryKey: notificationTabCountsKey(currentUserId) });
        }
      } catch (error) {
        console.error("Error marking notification as read:", error);
        rollback();
      }
    },
    [notifications, queryClient, currentUserId]
  );

  // Atualiza TODAS as notificações não lidas da pessoa no servidor (não só as carregadas no resumo).
  const markAllAsRead = useCallback(async () => {
    if (!currentUserId) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    optimisticallyMarkAllReadInHistoryCache(queryClient);
    queryClient.setQueriesData<NotificationTabCounts | undefined>(
      { queryKey: notificationTabCountsKey(currentUserId) },
      (old) => (old ? { all: 0, sales: 0, checkpoints: 0, forms: 0, mentions: 0, other: 0 } : old)
    );

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", currentUserId)
        .eq("is_read", false);

      if (error) throw error;
    } catch (error) {
      console.error("Error marking all as read:", error);
      invalidateNotificationsQueries(queryClient, currentUserId);
      await fetchUnreadCount(currentUserId);
    }
  }, [currentUserId, queryClient]);

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
