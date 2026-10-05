import { forwardRef, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import {
  NOTIFICATION_TABS,
  type NotificationTabId,
  getTabForNotification,
  useNotificationTabCounts,
  useNotificationsHistoryPage,
} from "@/hooks/useNotificationsHistory";
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
  Inbox,
  CalendarCheck,
} from "lucide-react";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { usePaginationState } from "@/hooks/usePagedList";
import { PagerFor } from "@/components/ui/list-pagination";
import { PushNotificationPreferences } from "@/components/notifications/PushNotificationPreferences";

const TAB_ICONS: Record<NotificationTabId, typeof Inbox> = {
  all: Inbox,
  sales: ShoppingCart,
  checkpoints: CalendarCheck,
  forms: FileText,
  mentions: AtSign,
  other: MessageSquare,
};

const TABS = NOTIFICATION_TABS.map((tab) => ({ ...tab, icon: TAB_ICONS[tab.id] }));

type TabId = NotificationTabId;

const Notifications = forwardRef<HTMLDivElement>(function Notifications(_, ref) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const {
    unreadCount,
    loading,
    notificationPermission,
    pushSubscribed,
    markAsRead,
    markAllAsRead,
    requestNotificationPermission,
  } = useNotifications();

  // Página de Notificações: histórico completo em react-query, com key
  // incluindo usuário + filtros (aba) + página, independente do resumo
  // recente do sino/contexto.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

  // Contagem inicial "chutada" (1 página) só para não travar a paginação antes
  // do primeiro fetch — ajustada assim que a query resolve.
  const [pageTotal, setPageTotal] = useState(0);
  const pg = usePaginationState(pageTotal, { resetKey: activeTab, defaultPageSize: 20 });

  const historyQuery = useNotificationsHistoryPage(currentUserId, activeTab, pg.currentPage, pg.pageSize);
  const pageLoading = historyQuery.isLoading;
  const pageRows = historyQuery.data?.rows ?? [];

  useEffect(() => {
    if (historyQuery.data) setPageTotal(historyQuery.data.total);
  }, [historyQuery.data]);

  // Badges por aba: contagem GLOBAL de não lidas por categoria, calculada no
  // servidor (RPC) com o mesmo predicado da aba — não depende das notificações
  // carregadas no cliente.
  const { counts: tabCounts } = useNotificationTabCounts(currentUserId);

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
