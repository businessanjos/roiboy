import { forwardRef, useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  BellRing,
  CheckCheck,
  AtSign,
  ExternalLink,
  ShoppingCart,
  FileText,
  MessageSquare,
  ScrollText,
  Inbox,
  CalendarCheck,
} from "lucide-react";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { usePaginationState } from "@/hooks/usePagedList";
import { PagerFor } from "@/components/ui/list-pagination";
import { PushNotificationPreferences } from "@/components/notifications/PushNotificationPreferences";

const TABS = [
  { id: "all", label: "Todas", icon: Inbox },
  { id: "sales", label: "Vendas", icon: ShoppingCart },
  { id: "checkpoints", label: "Checkpoints", icon: CalendarCheck },
  { id: "forms", label: "Formulários", icon: FileText },
  { id: "mentions", label: "Menções", icon: AtSign },
  { id: "other", label: "Outros", icon: MessageSquare },
] as const;

type TabId = (typeof TABS)[number]["id"];

const SOURCE_TYPE_MAP: Record<string, TabId> = {
  deal: "sales",
  contract_renewal: "sales",
  client_contracts: "sales",
  form_response: "forms",
  client_followup: "mentions",
  client_checkpoint: "checkpoints",
  client_checkpoint_digest: "checkpoints",
};

// Inverso de SOURCE_TYPE_MAP — usado para filtrar no servidor por aba.
const TAB_SOURCE_TYPES: Record<Exclude<TabId, "all" | "other">, string[]> = {
  sales: ["deal", "contract_renewal", "client_contracts"],
  forms: ["form_response"],
  mentions: ["client_followup"],
  checkpoints: ["client_checkpoint", "client_checkpoint_digest"],
};
const KNOWN_SOURCE_TYPES = Object.values(TAB_SOURCE_TYPES).flat();


function getTabForNotification(sourceType: string | null): TabId {
  if (!sourceType) return "other";
  return SOURCE_TYPE_MAP[sourceType] || "other";
}

const Notifications = forwardRef<HTMLDivElement>(function Notifications(_, ref) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const { 
    notifications, 
    unreadCount, 
    loading, 
    notificationPermission,
    pushSubscribed,
    markAsRead, 
    markAllAsRead,
    requestNotificationPermission,
  } = useNotifications();

  // Página de Notificações: histórico completo com paginação no SERVIDOR
  // (count exato + range), independente do resumo recente do sino/contexto.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pageRows, setPageRows] = useState<any[]>([]);
  const [pageTotal, setPageTotal] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser || cancelled) return;
      const { data: userData } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();
      if (!cancelled && userData) setCurrentUserId(userData.id);
    })();
    return () => { cancelled = true; };
  }, []);

  const pg = usePaginationState(pageTotal, { resetKey: activeTab, defaultPageSize: 20, isLoading: pageLoading });

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    setPageLoading(true);
    (async () => {
      let query = supabase
        .from("notifications")
        .select(
          `*, triggered_by_user:users!notifications_triggered_by_user_id_fkey(name, avatar_url)`,
          { count: "exact" }
        )
        .eq("user_id", currentUserId);

      if (activeTab === "other") {
        // "Outros": sem source_type ou de um tipo não mapeado a nenhuma aba conhecida.
        query = query.or(
          `source_type.is.null,source_type.not.in.(${KNOWN_SOURCE_TYPES.join(",")})`
        );
      } else if (activeTab !== "all") {
        query = query.in(
          "source_type",
          TAB_SOURCE_TYPES[activeTab as Exclude<TabId, "all" | "other">]
        );
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(pg.from, pg.to);

      if (cancelled) return;
      if (error) {
        console.error("Error fetching notifications page:", error);
        setPageRows([]);
        setPageTotal(0);
      } else {
        setPageRows(data || []);
        setPageTotal(count ?? 0);
      }
      setPageLoading(false);
    })();
    return () => { cancelled = true; };
  }, [currentUserId, activeTab, pg.from, pg.to]);

  const tabCounts = useMemo(() => {
    const counts: Record<TabId, number> = { all: 0, sales: 0, checkpoints: 0, forms: 0, mentions: 0, other: 0 };
    notifications.forEach((n) => {
      if (!n.is_read) {
        counts.all++;
        counts[getTabForNotification(n.source_type)]++;
      }
    });
    return counts;
  }, [notifications]);

  const handleNotificationClick = async (notification: any) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const getIcon = (sourceType: string | null) => {
    const tab = getTabForNotification(sourceType);
    switch (tab) {
      case "sales": return <ShoppingCart className="h-4 w-4" />;
      case "checkpoints": return <CalendarCheck className="h-4 w-4" />;
      case "forms": return <FileText className="h-4 w-4" />;
      case "mentions": return <AtSign className="h-4 w-4" />;
      
      default: return <Bell className="h-4 w-4" />;
    }
  };

  if (loading || (pageLoading && pageRows.length === 0)) {
    return <LoadingScreen message="Carregando notificações..." fullScreen={false} />;
  }

  return (
    <div ref={ref} className="container max-w-3xl py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Notificações</h1>
          {unreadCount > 0 && (
            <Badge variant="default">{unreadCount} não lidas</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {notificationPermission === "default" && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={requestNotificationPermission}
              className="gap-2"
            >
              <BellRing className="h-4 w-4" />
              Ativar notificações
            </Button>
          )}
          {notificationPermission === "denied" && (
            <Badge variant="destructive" className="gap-1">
              <BellRing className="h-3 w-3" />
              Bloqueado
            </Badge>
          )}
          {notificationPermission === "granted" && (
            <Badge variant="secondary" className="gap-1">
              <BellRing className="h-3 w-3" />
              {pushSubscribed ? "Push ativo ✓" : "Notificações ativas"}
            </Badge>
          )}
        </div>
      </div>

      {/* Push notification preferences - always visible */}
      <PushNotificationPreferences />

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = tabCounts[tab.id];
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {count > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none ${
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-primary/10 text-primary"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Marcar todas como lidas
          </Button>
        </div>
      )}

      {pageRows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              {activeTab === "all" ? "Nenhuma notificação" : "Nenhuma notificação nesta categoria"}
            </p>
            <p className="text-sm text-muted-foreground/70">
              {activeTab === "all"
                ? "Você será notificado quando alguém mencionar você"
                : "As notificações aparecerão aqui quando houver novidades"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {pageRows.map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`w-full text-left p-4 rounded-lg border transition-colors ${
                notification.is_read
                  ? "bg-card hover:bg-muted/50"
                  : "bg-primary/5 border-primary/20 hover:bg-primary/10"
              }`}
            >
              <div className="flex gap-3">
                {notification.triggered_by_user ? (
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage
                      src={notification.triggered_by_user.avatar_url || undefined}
                    />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {notification.triggered_by_user.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-10 w-10 flex-shrink-0 rounded-full bg-muted flex items-center justify-center">
                    {getIcon(notification.source_type)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm ${
                        notification.is_read
                          ? "text-foreground"
                          : "font-medium text-foreground"
                      }`}
                    >
                      {notification.title}
                    </p>
                    {!notification.is_read && (
                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  
                  {notification.content && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.content}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span>
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                    {notification.link && (
                      <span className="flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        Ver
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {pageRows.length > 0 && (
        <PagerFor state={pg} itemLabel="notificações" />
      )}
    </div>
  );
});

export default Notifications;
