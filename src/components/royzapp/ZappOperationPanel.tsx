import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { format, isFuture, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Calendar, 
  CheckSquare, 
  Users,
  ExternalLink,
  Clock,
  MapPin,
  ChevronRight,
  CheckCircle2,
  Circle,
  Loader2,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getEventTypeConfig } from "@/config/eventTypes";

interface ZappOperationPanelProps {
  sectorId?: string;
}

interface OperationEvent {
  id: string;
  title: string;
  event_type: string;
  scheduled_at: string;
  start_time: string | null;
  address: string | null;
  max_capacity: number | null;
  confirmed_count: number;
  attended_count: number;
}

interface ChecklistItem {
  id: string;
  title: string;
  display_order: number;
  stage_id: string;
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

export function ZappOperationPanel({ sectorId }: ZappOperationPanelProps) {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"events" | "checklist">("events");
  const [searchQuery, setSearchQuery] = useState("");
  const [eventFilter, setEventFilter] = useState<"upcoming" | "past">("upcoming");

  // Fetch operation events
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["operation-events-zapp", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, event_type, scheduled_at, start_time, address, max_capacity")
        .eq("category", "operation")
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      
      // Fetch counts for each event
      const eventsWithCounts: OperationEvent[] = [];
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
          ...event,
          confirmed_count: confirmedResult.count || 0,
          attended_count: attendanceResult.count || 0,
        });
      }

      return eventsWithCounts;
    },
    enabled: !!currentUser?.account_id,
  });

  // Fetch checklist items grouped by client and stage
  const { data: clientChecklists = [], isLoading: checklistLoading, refetch: refetchChecklists } = useQuery({
    queryKey: ["client-checklists-zapp", currentUser?.account_id],
    queryFn: async () => {
      // First get clients with their stages
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select(`
          id, full_name, stage_id,
          client_stages (id, name, color)
        `)
        .not("stage_id", "is", null)
        .order("full_name")
        .limit(50);

      if (clientsError) throw clientsError;

      // Get checklist items for each stage
      const stageIds = [...new Set(clients?.map(c => c.stage_id).filter(Boolean))];
      
      const { data: checklistItems, error: itemsError } = await supabase
        .from("stage_checklist_items")
        .select("id, title, stage_id, display_order")
        .in("stage_id", stageIds)
        .order("display_order");

      if (itemsError) throw itemsError;

      // Get completed items
      const clientIds = clients?.map(c => c.id) || [];
      const { data: completedItems, error: completedError } = await supabase
        .from("client_stage_checklist")
        .select("client_id, checklist_item_id, completed_at")
        .in("client_id", clientIds);

      if (completedError) throw completedError;

      // Group by client
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

        // Only show clients with pending items
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
    enabled: !!currentUser?.account_id,
  });

  // Toggle checklist item
  const toggleChecklistItem = async (clientId: string, itemId: string, completed: boolean) => {
    if (!currentUser?.account_id) return;

    try {
      if (completed) {
        // Mark as completed
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
        // Remove completion
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

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const eventDate = new Date(event.scheduled_at);
      const matchesFilter = eventFilter === "upcoming" 
        ? (isFuture(eventDate) || isToday(eventDate))
        : (isPast(eventDate) && !isToday(eventDate));
      
      const matchesSearch = !searchQuery || 
        event.title.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesFilter && matchesSearch;
    });
  }, [events, eventFilter, searchQuery]);

  // Filter checklists
  const filteredChecklists = useMemo(() => {
    return clientChecklists.filter(cl => 
      !searchQuery || cl.client_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [clientChecklists, searchQuery]);

  const isSoldOut = (event: OperationEvent) => 
    event.max_capacity && event.confirmed_count >= event.max_capacity;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zapp-border bg-zapp-bg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-zapp-accent" />
            <span className="font-medium text-zapp-text">Operação</span>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-7 text-xs"
            onClick={() => navigate("/events")}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Abrir
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zapp-text-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar..."
            className="pl-8 h-8 text-sm bg-zapp-panel border-zapp-border text-zapp-text"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-full h-8 bg-zapp-panel">
            <TabsTrigger value="events" className="flex-1 h-6 text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              Eventos
            </TabsTrigger>
            <TabsTrigger value="checklist" className="flex-1 h-6 text-xs">
              <CheckSquare className="h-3 w-3 mr-1" />
              Checklist
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {activeTab === "events" ? (
          <div className="p-3">
            {/* Event filter */}
            <div className="flex gap-1 mb-3">
              <Button
                size="sm"
                variant={eventFilter === "upcoming" ? "default" : "ghost"}
                className="h-7 text-xs flex-1"
                onClick={() => setEventFilter("upcoming")}
              >
                Próximos
              </Button>
              <Button
                size="sm"
                variant={eventFilter === "past" ? "default" : "ghost"}
                className="h-7 text-xs flex-1"
                onClick={() => setEventFilter("past")}
              >
                Passados
              </Button>
            </div>

            {eventsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-zapp-accent" />
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-zapp-text-muted text-sm">
                Nenhum evento encontrado
              </div>
            ) : (
              <div className="space-y-2">
                {filteredEvents.map(event => {
                  const eventDate = new Date(event.scheduled_at);
                  return (
                    <Card 
                      key={event.id} 
                      className="p-3 bg-zapp-panel border-zapp-border cursor-pointer hover:bg-zapp-panel/80"
                      onClick={() => navigate(`/events/${event.id}`)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zapp-accent/10 flex items-center justify-center flex-shrink-0">
                          <Calendar className="h-5 w-5 text-zapp-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-medium text-sm text-zapp-text truncate">{event.title}</p>
                            {isSoldOut(event) && (
                              <Badge variant="destructive" className="text-[10px]">Esgotado</Badge>
                            )}
                            {isToday(eventDate) && (
                              <Badge className="bg-green-500 text-white text-[10px]">Hoje</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-zapp-text-muted">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(eventDate, "dd MMM", { locale: ptBR })}
                              {event.start_time && ` ${event.start_time.slice(0, 5)}`}
                            </span>
                            {event.address && (
                              <span className="flex items-center gap-1 truncate">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate max-w-[100px]">{event.address}</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zapp-text-muted">
                            <Users className="h-3 w-3" />
                            <span className={isSoldOut(event) ? "text-destructive font-medium" : ""}>
                              {event.confirmed_count}{event.max_capacity ? `/${event.max_capacity}` : ''} confirmados
                            </span>
                            {event.attended_count > 0 && (
                              <span>• {event.attended_count} presentes</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-zapp-text-muted flex-shrink-0" />
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="p-3">
            {checklistLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-zapp-accent" />
              </div>
            ) : filteredChecklists.length === 0 ? (
              <div className="text-center py-8 text-zapp-text-muted text-sm">
                Nenhum checklist pendente
              </div>
            ) : (
              <div className="space-y-3">
                {filteredChecklists.map(client => (
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
        )}
      </ScrollArea>
    </div>
  );
}
