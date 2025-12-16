import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Video,
  FileText,
  Calendar,
  Clock,
  Check,
  X,
  ExternalLink,
  Package,
} from "lucide-react";
import { format, isPast, isFuture, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: "live" | "material";
  scheduled_at: string | null;
  duration_minutes: number | null;
  meeting_url: string | null;
  material_url: string | null;
  is_recurring: boolean;
}

interface EventProduct {
  product_id: string;
}

interface EventWithProducts extends Event {
  event_products: EventProduct[];
}

interface ClientDelivery {
  id: string;
  event_id: string;
  status: "pending" | "delivered" | "missed";
  delivered_at: string | null;
  delivery_method: string | null;
  notes: string | null;
}

interface ClientAgendaProps {
  clientId: string;
  clientProductIds: string[];
}

export function ClientAgenda({ clientId, clientProductIds }: ClientAgendaProps) {
  const [events, setEvents] = useState<EventWithProducts[]>([]);
  const [deliveries, setDeliveries] = useState<ClientDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    fetchAccountId();
  }, []);

  useEffect(() => {
    if (accountId) {
      fetchEvents();
      fetchDeliveries();
    }
  }, [accountId, clientProductIds]);

  const fetchAccountId = async () => {
    const { data } = await supabase
      .from("users")
      .select("account_id")
      .single();
    
    if (data) {
      setAccountId(data.account_id);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    
    // Get events linked to the client's products
    const { data, error } = await supabase
      .from("events")
      .select(`
        *,
        event_products (product_id)
      `)
      .order("scheduled_at", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Error fetching events:", error);
      setEvents([]);
    } else {
      // Filter events that match client's products
      const filteredEvents = (data || []).filter((event: EventWithProducts) => {
        if (event.event_products.length === 0) return false;
        return event.event_products.some((ep) => 
          clientProductIds.includes(ep.product_id)
        );
      });
      setEvents(filteredEvents as EventWithProducts[]);
    }
    setLoading(false);
  };

  const fetchDeliveries = async () => {
    const { data, error } = await supabase
      .from("client_event_deliveries")
      .select("*")
      .eq("client_id", clientId);

    if (!error) {
      setDeliveries((data || []) as ClientDelivery[]);
    }
  };

  const getDeliveryStatus = (eventId: string): ClientDelivery | undefined => {
    return deliveries.find((d) => d.event_id === eventId);
  };

  const toggleDelivery = async (eventId: string, currentStatus?: string) => {
    if (!accountId) return;

    const delivery = getDeliveryStatus(eventId);
    
    if (delivery) {
      // Update existing delivery
      const newStatus = currentStatus === "delivered" ? "pending" : "delivered";
      const { error } = await supabase
        .from("client_event_deliveries")
        .update({
          status: newStatus,
          delivered_at: newStatus === "delivered" ? new Date().toISOString() : null,
          delivery_method: newStatus === "delivered" ? "manual" : null,
        })
        .eq("id", delivery.id);

      if (error) {
        toast.error("Erro ao atualizar entrega");
      } else {
        toast.success(newStatus === "delivered" ? "Marcado como entregue!" : "Desmarcado");
        fetchDeliveries();
      }
    } else {
      // Create new delivery
      const { error } = await supabase
        .from("client_event_deliveries")
        .insert({
          account_id: accountId,
          client_id: clientId,
          event_id: eventId,
          status: "delivered",
          delivered_at: new Date().toISOString(),
          delivery_method: "manual",
        });

      if (error) {
        toast.error("Erro ao registrar entrega");
      } else {
        toast.success("Marcado como entregue!");
        fetchDeliveries();
      }
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Carregando agenda...
      </div>
    );
  }

  if (clientProductIds.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Este cliente não possui produtos vinculados.</p>
        <p className="text-sm mt-1">Vincule produtos para ver os eventos programados.</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Nenhum evento programado para os produtos deste cliente.</p>
        <p className="text-sm mt-1">Crie eventos na aba Eventos e vincule aos produtos.</p>
      </div>
    );
  }

  // Separate events by status
  const upcomingEvents = events.filter(
    (e) => e.scheduled_at && (isFuture(new Date(e.scheduled_at)) || isToday(new Date(e.scheduled_at)))
  );
  const pastEvents = events.filter(
    (e) => e.scheduled_at && isPast(new Date(e.scheduled_at)) && !isToday(new Date(e.scheduled_at))
  );
  const materialsEvents = events.filter((e) => e.event_type === "material");

  return (
    <div className="space-y-6">
      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Próximos Eventos
          </h3>
          <div className="space-y-3">
            {upcomingEvents.map((event) => {
              const delivery = getDeliveryStatus(event.id);
              const isDelivered = delivery?.status === "delivered";

              return (
                <div
                  key={event.id}
                  className={cn(
                    "border rounded-lg p-4 transition-all",
                    isToday(new Date(event.scheduled_at!))
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        event.event_type === "live" ? "bg-indigo-500/10 text-indigo-500" : "bg-amber-500/10 text-amber-500"
                      )}>
                        {event.event_type === "live" ? (
                          <Video className="h-5 w-5" />
                        ) : (
                          <FileText className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{event.title}</p>
                        {event.scheduled_at && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(event.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            {event.duration_minutes && ` • ${event.duration_minutes}min`}
                          </p>
                        )}
                        {isToday(new Date(event.scheduled_at!)) && (
                          <Badge variant="default" className="mt-1">Hoje</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {event.meeting_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={event.meeting_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Entrar
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Materials */}
      {materialsEvents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Materiais de Apoio
          </h3>
          <div className="space-y-2">
            {materialsEvents.map((event) => {
              const delivery = getDeliveryStatus(event.id);
              const isDelivered = delivery?.status === "delivered";

              return (
                <div
                  key={event.id}
                  className={cn(
                    "border rounded-lg p-3 flex items-center justify-between",
                    isDelivered && "bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isDelivered}
                      onCheckedChange={() => toggleDelivery(event.id, delivery?.status)}
                    />
                    <div>
                      <p className={cn("font-medium", isDelivered && "line-through text-muted-foreground")}>
                        {event.title}
                      </p>
                      {event.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDelivered && delivery?.delivered_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(delivery.delivered_at), "dd/MM", { locale: ptBR })}
                      </span>
                    )}
                    {event.material_url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={event.material_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Eventos Passados
          </h3>
          <div className="space-y-2">
            {pastEvents.map((event) => {
              const delivery = getDeliveryStatus(event.id);
              const isDelivered = delivery?.status === "delivered";

              return (
                <div
                  key={event.id}
                  className={cn(
                    "border rounded-lg p-3 flex items-center justify-between",
                    isDelivered ? "bg-emerald-500/5 border-emerald-500/20" : "bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isDelivered}
                      onCheckedChange={() => toggleDelivery(event.id, delivery?.status)}
                    />
                    <div className={cn(
                      "w-8 h-8 rounded flex items-center justify-center",
                      isDelivered ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                    )}>
                      {isDelivered ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className={cn(
                        "font-medium",
                        !isDelivered && "text-muted-foreground"
                      )}>
                        {event.title}
                      </p>
                      {event.scheduled_at && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(event.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDelivered ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                        Participou
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Não participou
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
