import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { format, isFuture, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Calendar, 
  Video, 
  MapPin, 
  Users, 
  ExternalLink,
  Megaphone,
  Clock,
  ChevronRight,
  Link,
  Briefcase,
  CheckSquare,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getEventTypeConfig } from "@/config/eventTypes";

interface ZappMarketingListProps {
  sectorId?: string;
}

interface ClientChecklist {
  client_id: string;
  client_name: string;
  stage_name: string;
  stage_color: string;
  items: {
    id: string;
    item_id: string;
    title: string;
    completed: boolean;
  }[];
}

interface MarketingEvent {
  id: string;
  title: string;
  event_type: string;
  scheduled_at: string;
  start_time: string | null;
  address: string | null;
  meeting_url: string | null;
  goal_invited: number | null;
  goal_confirmed: number | null;
  goal_present: number | null;
  public_registration_code: string | null;
  confirmed_count: number;
  attended_count: number;
  max_capacity: number | null;
}

export function ZappMarketingList({ sectorId }: ZappMarketingListProps) {
  const { session } = useAuth();
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"upcoming" | "past">("upcoming");
  const [activeTab, setActiveTab] = useState<"events" | "checklist">("events");

  // Determinar categoria baseado no setor
  const isOperationSector = sectorId === "operacoes";
  const isVendasSector = sectorId === "vendas";

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["zapp-marketing-events", session?.user?.id, sectorId],
    queryFn: async (): Promise<MarketingEvent[]> => {
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", session?.user?.id || "")
        .maybeSingle();

      if (!userData?.account_id) return [];

      // Build query based on sector
      let query = supabase
        .from("events")
        .select("id, title, event_type, scheduled_at, start_time, address, meeting_url, goal_invited, goal_confirmed, goal_present, public_registration_code, allow_external_guests, max_capacity, visible_sectors")
        .eq("account_id", userData.account_id);
      
      if (isVendasSector) {
        // For sales sector: show events that allow external guests OR have vendas in visible_sectors
        query = query.or(`allow_external_guests.eq.true,visible_sectors.cs.["vendas"]`);
      } else if (isOperationSector) {
        // For operations: show operation events OR have operacoes in visible_sectors
        query = query.or(`category.eq.operation,visible_sectors.cs.["operacoes"]`);
      } else {
        // For marketing and others: show marketing events
        query = query.eq("category", "marketing");
      }
      
      const { data, error } = await query.order("scheduled_at", { ascending: true });

      if (error) throw error;
      
      // Fetch attendance and confirmed counts for each event
      const eventsWithCounts: MarketingEvent[] = [];
      for (const event of (data || [])) {
        const [attendanceResult, confirmedResult] = await Promise.all([
          supabase
            .from("attendance")
            .select("*", { count: "exact", head: true })
            .eq("event_id", event.id),
          supabase
            .from("event_participants")
            .select("*", { count: "exact", head: true })
            .eq("event_id", event.id)
            .eq("rsvp_status", "confirmed")
        ]);

        eventsWithCounts.push({
          id: event.id,
          title: event.title,
          event_type: event.event_type,
          scheduled_at: event.scheduled_at,
          start_time: event.start_time,
          address: event.address,
          meeting_url: event.meeting_url,
          goal_invited: event.goal_invited,
          goal_confirmed: event.goal_confirmed,
          goal_present: event.goal_present,
          public_registration_code: event.public_registration_code,
          confirmed_count: confirmedResult.count || 0,
          attended_count: attendanceResult.count || 0,
          max_capacity: event.max_capacity,
        });
      }

      return eventsWithCounts;
    },
    enabled: !!session?.user?.id,
  });

  // Fetch checklist items grouped by client and stage (only for operations)
  const { data: clientChecklists = [], isLoading: checklistLoading, refetch: refetchChecklists } = useQuery({
    queryKey: ["client-checklists-zapp", currentUser?.account_id],
    queryFn: async () => {
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select(`id, full_name, stage_id, client_stages (id, name, color)`)
        .not("stage_id", "is", null)
        .order("full_name")
        .limit(50);

      if (clientsError) throw clientsError;

      const stageIds = [...new Set(clients?.map(c => c.stage_id).filter(Boolean))];
      
      const { data: checklistItems, error: itemsError } = await supabase
        .from("stage_checklist_items")
        .select("id, title, stage_id, display_order")
        .in("stage_id", stageIds)
        .order("display_order");

      if (itemsError) throw itemsError;

      const clientIds = clients?.map(c => c.id) || [];
      const { data: completedItems, error: completedError } = await supabase
        .from("client_stage_checklist")
        .select("client_id, checklist_item_id, completed_at")
        .in("client_id", clientIds);

      if (completedError) throw completedError;

      const completedMap = new Map<string, Set<string>>();
      completedItems?.forEach(ci => {
        if (!completedMap.has(ci.client_id)) {
          completedMap.set(ci.client_id, new Set());
        }
        completedMap.get(ci.client_id)!.add(ci.checklist_item_id);
      });

      const result: ClientChecklist[] = [];
      clients?.forEach(client => {
        const stage = client.client_stages as any;
        if (!stage) return;

        const stageItems = checklistItems?.filter(i => i.stage_id === client.stage_id) || [];
        const clientCompleted = completedMap.get(client.id) || new Set();

        const hasIncomplete = stageItems.some(i => !clientCompleted.has(i.id));
        if (!hasIncomplete && stageItems.length > 0) return;

        result.push({
          client_id: client.id,
          client_name: client.full_name,
          stage_name: stage.name,
          stage_color: stage.color,
          items: stageItems.map(i => ({
            id: `${client.id}-${i.id}`,
            item_id: i.id,
            title: i.title,
            completed: clientCompleted.has(i.id),
          })),
        });
      });

      return result;
    },
    enabled: !!currentUser?.account_id && isOperationSector,
  });

  // Toggle checklist item
  const toggleChecklistItem = async (clientId: string, itemId: string, completed: boolean) => {
    if (!currentUser?.account_id) return;

    try {
      if (completed) {
        const { error } = await supabase
          .from("client_stage_checklist")
          .insert({
            account_id: currentUser.account_id,
            client_id: clientId,
            checklist_item_id: itemId,
            completed_at: new Date().toISOString(),
            completed_by: currentUser.id,
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("client_stage_checklist")
          .delete()
          .eq("client_id", clientId)
          .eq("checklist_item_id", itemId);
        if (error) throw error;
      }
      
      refetchChecklists();
      toast.success(completed ? "Item concluído!" : "Item reaberto");
    } catch (error) {
      console.error("Error toggling checklist:", error);
      toast.error("Erro ao atualizar checklist");
    }
  };

  const filteredEvents = events.filter((event) => {
    const eventDate = new Date(event.scheduled_at);
    if (filter === "upcoming") {
      return isFuture(eventDate) || isToday(eventDate);
    }
    return isPast(eventDate) && !isToday(eventDate);
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case "live":
      case "webinar":
        return Video;
      case "presencial":
      case "workshop":
        return MapPin;
      default:
        return Calendar;
    }
  };

  const isSoldOut = (event: MarketingEvent) => 
    event.max_capacity && event.confirmed_count >= event.max_capacity;

  const getEventStatusBadge = (event: MarketingEvent) => {
    const eventDate = new Date(event.scheduled_at);
    if (isSoldOut(event)) {
      return <Badge variant="destructive" className="text-[10px]">Esgotado</Badge>;
    }
    if (isToday(eventDate)) {
      return <Badge className="bg-green-500 text-white text-[10px]">Hoje</Badge>;
    }
    if (isPast(eventDate)) {
      return <Badge variant="secondary" className="text-[10px]">Encerrado</Badge>;
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zapp-border bg-zapp-bg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isOperationSector ? (
              <Briefcase className="h-4 w-4 text-zapp-accent" />
            ) : (
              <Megaphone className="h-4 w-4 text-zapp-accent" />
            )}
            <span className="font-medium text-zapp-text">
              {isOperationSector ? "Operação" : "Marketing"}
            </span>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-7 text-xs"
            onClick={() => navigate(isOperationSector ? "/events" : "/marketing")}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Abrir
          </Button>
        </div>
        
        {/* Tabs for Operations sector */}
        {isOperationSector ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid grid-cols-2 w-full h-8 bg-zapp-panel p-0.5">
              <TabsTrigger value="events" className="h-6 text-xs px-2 gap-1">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Eventos</span>
              </TabsTrigger>
              <TabsTrigger value="checklist" className="h-6 text-xs px-2 gap-1">
                <CheckSquare className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Checklist</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        ) : (
          /* Filter tabs for non-operation sectors */
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={filter === "upcoming" ? "default" : "ghost"}
              className="h-7 text-xs flex-1"
              onClick={() => setFilter("upcoming")}
            >
              Próximos
            </Button>
            <Button
              size="sm"
              variant={filter === "past" ? "default" : "ghost"}
              className="h-7 text-xs flex-1"
              onClick={() => setFilter("past")}
            >
              Passados
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {isOperationSector && activeTab === "checklist" ? (
          /* Checklist view for operations */
          <div className="p-3">
            {checklistLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-zapp-accent" />
              </div>
            ) : clientChecklists.length === 0 ? (
              <div className="text-center py-8 text-zapp-text-muted text-sm">
                Nenhum checklist pendente
              </div>
            ) : (
              <div className="space-y-3">
                {clientChecklists.map(client => (
                  <Card 
                    key={client.client_id} 
                    className="p-3 bg-zapp-panel border-zapp-border"
                  >
                    <div 
                      className="flex items-center gap-2 mb-2 cursor-pointer"
                      onClick={() => navigate(`/clients/${client.client_id}`)}
                    >
                      <p className="font-medium text-sm text-zapp-text truncate flex-1">
                        {client.client_name}
                      </p>
                      <Badge 
                        className="text-[10px] px-1.5 py-0"
                        style={{ backgroundColor: client.stage_color }}
                      >
                        {client.stage_name}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1.5">
                      {client.items.map(item => (
                        <div 
                          key={item.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={(checked) => 
                              toggleChecklistItem(client.client_id, item.item_id, !!checked)
                            }
                            className="h-4 w-4"
                          />
                          <span className={item.completed ? "line-through text-zapp-text-muted" : "text-zapp-text"}>
                            {item.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Events list */
          <>
            {/* Event filter for operations */}
            {isOperationSector && activeTab === "events" && (
              <div className="px-3 pt-3 pb-1 flex gap-1">
                <Button
                  size="sm"
                  variant={filter === "upcoming" ? "default" : "ghost"}
                  className="h-7 text-xs flex-1"
                  onClick={() => setFilter("upcoming")}
                >
                  Próximos
                </Button>
                <Button
                  size="sm"
                  variant={filter === "past" ? "default" : "ghost"}
                  className="h-7 text-xs flex-1"
                  onClick={() => setFilter("past")}
                >
                  Passados
                </Button>
              </div>
            )}
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-zapp-accent border-t-transparent rounded-full" />
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-zapp-panel flex items-center justify-center mb-3">
                  <Calendar className="h-8 w-8 text-zapp-text-muted" />
                </div>
                <p className="text-zapp-text-muted text-sm">
                  {filter === "upcoming" ? "Nenhum evento próximo" : "Nenhum evento passado"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zapp-border">
                {filteredEvents.map((event) => {
                  const IconComponent = getEventIcon(event.event_type);
                  const eventDate = new Date(event.scheduled_at);
                  
                  return (
                    <div
                      key={event.id}
                      className="px-4 py-3 hover:bg-zapp-panel cursor-pointer transition-colors"
                      onClick={() => navigate(`/events/${event.id}`)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zapp-accent/10 flex items-center justify-center flex-shrink-0">
                          <IconComponent className="h-5 w-5 text-zapp-accent" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-sm text-zapp-text truncate">
                              {event.title}
                            </span>
                            <Badge 
                              className="text-[10px] px-1.5 py-0"
                              style={{ 
                                backgroundColor: `${getEventTypeConfig(event.event_type).defaultColor}20`,
                                color: getEventTypeConfig(event.event_type).defaultColor,
                                borderColor: getEventTypeConfig(event.event_type).defaultColor
                              }}
                            >
                              {getEventTypeConfig(event.event_type).label}
                            </Badge>
                            {getEventStatusBadge(event)}
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-zapp-text-muted">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(eventDate, "dd MMM", { locale: ptBR })}
                            </span>
                            {event.start_time && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {event.start_time.slice(0, 5)}
                              </span>
                            )}
                            {event.address && (
                              <span className="flex items-center gap-1 truncate max-w-[100px]">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{event.address}</span>
                              </span>
                            )}
                            {/* RSVP Link inline */}
                            {event.public_registration_code && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 text-[10px] px-1.5 gap-1 text-zapp-accent hover:text-zapp-accent"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const link = `${window.location.origin}/inscricao/${event.public_registration_code}`;
                                  navigator.clipboard.writeText(link);
                                  toast.success("Link de RSVP copiado!");
                                }}
                              >
                                <Link className="h-3 w-3" />
                                RSVP
                              </Button>
                            )}
                          </div>
                          
                          {/* Progress indicators - always show confirmed count */}
                          <div className="flex items-center gap-3 mt-2 text-[10px]">
                            <span className={`flex items-center gap-1 ${isSoldOut(event) ? 'text-destructive font-medium' : 'text-zapp-text-muted'}`}>
                              <Users className="h-3 w-3" />
                              {event.confirmed_count}{event.max_capacity ? `/${event.max_capacity}` : (event.goal_confirmed ? `/${event.goal_confirmed}` : '')} confirmados
                            </span>
                            {event.goal_present ? (
                              <span className="flex items-center gap-1 text-zapp-text-muted">
                                {event.attended_count}/{event.goal_present} presentes
                              </span>
                            ) : null}
                          </div>
                        </div>
                        
                        <ChevronRight className="h-4 w-4 text-zapp-text-muted flex-shrink-0" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </ScrollArea>
    </div>
  );
}