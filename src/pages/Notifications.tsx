import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  CheckCheck,
  Loader2,
  MessageSquare,
  AtSign,
  ExternalLink,
} from "lucide-react";

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
    useNotifications();

  const handleNotificationClick = async (notification: any) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "mention":
        return <AtSign className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Notificações</h1>
          {unreadCount > 0 && (
            <Badge variant="default">{unreadCount} não lidas</Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              Nenhuma notificação
            </p>
            <p className="text-sm text-muted-foreground/70">
              Você será notificado quando alguém mencionar você
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification, index) => (
            <div key={notification.id}>
              <button
                onClick={() => handleNotificationClick(notification)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  notification.is_read
                    ? "bg-card hover:bg-muted/50"
                    : "bg-primary/5 border-primary/20 hover:bg-primary/10"
                }`}
              >
                <div className="flex gap-3">
                  {/* Avatar or Icon */}
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
                      {getIcon(notification.type)}
                    </div>
                  )}

                  {/* Content */}
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

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                      {notification.link && (
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              </button>
              {index < notifications.length - 1 && <Separator className="my-1" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
