import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNow, format, isPast, isFuture, isToday, isTomorrow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  BellRing,
  CheckCheck,
  Loader2,
  AtSign,
  ExternalLink,
  ClipboardList,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  event_type: "live" | "material";
  client_id: string;
  client_name: string;
  delivery_id: string | null;
  status: "pending" | "delivered" | "missed";
}

export default function Notifications() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { 
    notifications, 
    unreadCount, 
    loading: notificationsLoading, 
    notificationPermission,
    markAsRead, 
    markAllAsRead,
    requestNotificationPermission,
  } = useNotifications();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("notifications");

  useEffect(() => {
    if (currentUser?.id) {
      fetchMyTasks();
    }
  }, [currentUser?.id]);

  const fetchMyTasks = async () => {
    if (!currentUser?.id) return;
    setTasksLoading(true);

    try {
      // 1. Find custom field of type "user"
      const { data: userFields } = await supabase
        .from("custom_fields")
        .select("id")
        .eq("field_type", "user")
        .eq("is_active", true);

      if (!userFields || userFields.length === 0) {
        setTasks([]);
        setTasksLoading(false);
        return;
      }

      const userFieldIds = userFields.map(f => f.id);

      // 2. Find clients where current user is assigned
      const { data: fieldValues } = await supabase
        .from("client_field_values")
        .select("client_id, value_json")
        .in("field_id", userFieldIds);

      if (!fieldValues) {
        setTasks([]);
        setTasksLoading(false);
        return;
      }

      // Filter to clients where current user is in the value_json array
      const myClientIds = fieldValues
        .filter(fv => {
          if (!fv.value_json) return false;
          const users = Array.isArray(fv.value_json) ? fv.value_json : [];
          return users.includes(currentUser.id);
        })
        .map(fv => fv.client_id);

      if (myClientIds.length === 0) {
        setTasks([]);
        setTasksLoading(false);
        return;
      }

      // 3. Get client names
      const { data: clients } = await supabase
        .from("clients")
        .select("id, full_name")
        .in("id", myClientIds);

      const clientMap = new Map(clients?.map(c => [c.id, c.full_name]) || []);

      // 4. Get products for these clients
      const { data: clientProducts } = await supabase
        .from("client_products")
        .select("client_id, product_id")
        .in("client_id", myClientIds);

      if (!clientProducts || clientProducts.length === 0) {
        setTasks([]);
        setTasksLoading(false);
        return;
      }

      // Map client to products
      const clientProductMap = new Map<string, string[]>();
      clientProducts.forEach(cp => {
        const existing = clientProductMap.get(cp.client_id) || [];
        existing.push(cp.product_id);
        clientProductMap.set(cp.client_id, existing);
      });

      const allProductIds = [...new Set(clientProducts.map(cp => cp.product_id))];

      // 5. Get events linked to those products
      const { data: eventProducts } = await supabase
        .from("event_products")
        .select("event_id, product_id")
        .in("product_id", allProductIds);

      if (!eventProducts || eventProducts.length === 0) {
        setTasks([]);
        setTasksLoading(false);
        return;
      }

      const eventIds = [...new Set(eventProducts.map(ep => ep.event_id))];

      // Map event to products
      const eventProductMap = new Map<string, string[]>();
      eventProducts.forEach(ep => {
        const existing = eventProductMap.get(ep.event_id) || [];
        existing.push(ep.product_id);
        eventProductMap.set(ep.event_id, existing);
      });

      // 6. Get events
      const { data: events } = await supabase
        .from("events")
        .select("id, title, scheduled_at, duration_minutes, event_type")
        .in("id", eventIds)
        .order("scheduled_at", { ascending: true });

      if (!events) {
        setTasks([]);
        setTasksLoading(false);
        return;
      }

      // 7. Get deliveries for all clients
      const { data: deliveries } = await supabase
        .from("client_event_deliveries")
        .select("id, client_id, event_id, status")
        .in("client_id", myClientIds);

      const deliveryMap = new Map<string, { id: string; status: string }>();
      deliveries?.forEach(d => {
        deliveryMap.set(`${d.client_id}-${d.event_id}`, { id: d.id, status: d.status });
      });

      // 8. Build tasks list - one task per client per event
      const tasksList: Task[] = [];

      myClientIds.forEach(clientId => {
        const clientProductIds = clientProductMap.get(clientId) || [];
        const clientName = clientMap.get(clientId) || "Cliente";

        events.forEach(event => {
          const eventProductIds = eventProductMap.get(event.id) || [];
          const hasMatchingProduct = eventProductIds.some(pid => clientProductIds.includes(pid));

          if (hasMatchingProduct) {
            const deliveryKey = `${clientId}-${event.id}`;
            const delivery = deliveryMap.get(deliveryKey);

            tasksList.push({
              id: `${clientId}-${event.id}`,
              title: event.title,
              scheduled_at: event.scheduled_at,
              duration_minutes: event.duration_minutes,
              event_type: event.event_type,
              client_id: clientId,
              client_name: clientName,
              delivery_id: delivery?.id || null,
              status: (delivery?.status as Task["status"]) || "pending",
            });
          }
        });
      });

      setTasks(tasksList);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  };

  const toggleTaskStatus = async (task: Task) => {
    if (!currentUser) return;

    try {
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .single();

      if (!userData) return;

      const newStatus = task.status === "delivered" ? "pending" : "delivered";

      if (task.delivery_id) {
        // Update existing delivery
        const { error } = await supabase
          .from("client_event_deliveries")
          .update({
            status: newStatus,
            delivered_at: newStatus === "delivered" ? new Date().toISOString() : null,
          })
          .eq("id", task.delivery_id);

        if (error) throw error;
      } else {
        // Create new delivery
        const [clientId, eventId] = task.id.split("-");
        const { error } = await supabase
          .from("client_event_deliveries")
          .insert({
            account_id: userData.account_id,
            client_id: clientId,
            event_id: eventId,
            status: "delivered",
            delivered_at: new Date().toISOString(),
            delivery_method: "manual",
          });

        if (error) throw error;
      }

      toast.success(newStatus === "delivered" ? "Tarefa concluída!" : "Tarefa reaberta");
      fetchMyTasks();
    } catch (error) {
      console.error("Error toggling task:", error);
      toast.error("Erro ao atualizar tarefa");
    }
  };

  const { upcomingTasks, overdueTasks, completedTasks } = useMemo(() => {
    const now = new Date();
    const upcoming: Task[] = [];
    const overdue: Task[] = [];
    const completed: Task[] = [];

    tasks.forEach(task => {
      if (task.status === "delivered") {
        completed.push(task);
      } else if (task.scheduled_at && isPast(parseISO(task.scheduled_at))) {
        overdue.push(task);
      } else {
        upcoming.push(task);
      }
    });

    return { upcomingTasks: upcoming, overdueTasks: overdue, completedTasks: completed };
  }, [tasks]);

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

  const formatTaskDate = (scheduledAt: string | null, durationMinutes: number | null) => {
    if (!scheduledAt) return null;
    
    const date = parseISO(scheduledAt);
    
    if (isToday(date)) {
      if (durationMinutes) {
        const endDate = new Date(date.getTime() + durationMinutes * 60000);
        return `Hoje, ${format(date, "HH:mm")} – ${format(endDate, "HH:mm")}`;
      }
      return `Hoje, ${format(date, "HH:mm")}`;
    }
    
    if (isTomorrow(date)) {
      if (durationMinutes) {
        const endDate = new Date(date.getTime() + durationMinutes * 60000);
        return `Amanhã, ${format(date, "HH:mm")} – ${format(endDate, "HH:mm")}`;
      }
      return `Amanhã, ${format(date, "HH:mm")}`;
    }
    
    return format(date, "d 'de' MMM 'de' yyyy", { locale: ptBR });
  };

  const TaskItem = ({ task, showCompleted = false }: { task: Task; showCompleted?: boolean }) => (
    <div
      className="flex items-center gap-3 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors px-2 rounded-md cursor-pointer"
      onClick={() => navigate(`/clients/${task.client_id}`)}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={task.status === "delivered"}
          onCheckedChange={() => toggleTaskStatus(task)}
          className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm ${showCompleted ? "line-through text-muted-foreground" : ""}`}>
            {task.title}
          </span>
          <Badge variant="outline" className="text-xs">
            {task.client_name}
          </Badge>
        </div>
      </div>
      {task.scheduled_at && (
        <span className={`text-xs whitespace-nowrap ${
          !showCompleted && isPast(parseISO(task.scheduled_at)) 
            ? "text-destructive font-medium" 
            : "text-green-600"
        }`}>
          {formatTaskDate(task.scheduled_at, task.duration_minutes)}
        </span>
      )}
    </div>
  );

  const loading = notificationsLoading || tasksLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-6 space-y-6">
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
              Ativar push
            </Button>
          )}
          {notificationPermission === "granted" && (
            <Badge variant="secondary" className="gap-1">
              <BellRing className="h-3 w-3" />
              Push ativo
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="notifications" className="gap-2">
            <AtSign className="h-4 w-4" />
            Menções
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">{unreadCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Minhas Tarefas
            {overdueTasks.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5">{overdueTasks.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-4">
          {unreadCount > 0 && (
            <div className="flex justify-end mb-3">
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                <CheckCheck className="h-4 w-4 mr-2" />
                Marcar todas como lidas
              </Button>
            </div>
          )}

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
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={currentUser?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {currentUser?.name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <CardTitle className="text-lg">Minhas tarefas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Tabs defaultValue="upcoming">
                <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                  <TabsTrigger 
                    value="upcoming" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                  >
                    Próximas
                  </TabsTrigger>
                  <TabsTrigger 
                    value="overdue" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                  >
                    Atrasadas
                    {overdueTasks.length > 0 && (
                      <Badge variant="destructive" className="ml-2 h-5 px-1.5">{overdueTasks.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="completed" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                  >
                    Concluídas
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upcoming" className="mt-4">
                  {upcomingTasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>Nenhuma tarefa pendente</p>
                    </div>
                  ) : (
                    <div>
                      {upcomingTasks.map(task => (
                        <TaskItem key={task.id} task={task} />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="overdue" className="mt-4">
                  {overdueTasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>Nenhuma tarefa atrasada</p>
                    </div>
                  ) : (
                    <div>
                      {overdueTasks.map(task => (
                        <TaskItem key={task.id} task={task} />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="completed" className="mt-4">
                  {completedTasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>Nenhuma tarefa concluída</p>
                    </div>
                  ) : (
                    <div>
                      {completedTasks.map(task => (
                        <TaskItem key={task.id} task={task} showCompleted />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
