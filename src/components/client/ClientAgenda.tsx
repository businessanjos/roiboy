import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Video,
  FileText,
  Calendar,
  Clock,
  Check,
  Users,
  Monitor,
  Package,
  MapPin,
  QrCode,
  Link as LinkIcon,
  Pencil,
  Plus,
} from "lucide-react";
import { ClientTasks } from "./ClientTasks";
import { ClientIndividualEventDialog } from "./ClientIndividualEventDialog";
import { format, isPast, isFuture, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { EventEditDialog, EventData, EventType } from "@/components/events/EventEditDialog";
import { useLinkedClients, getLinkedClientName } from "@/hooks/useLinkedClients";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  modality: "online" | "presencial";
  address: string | null;
  checkin_code: string | null;
  scheduled_at: string | null;
  ends_at: string | null;
  duration_minutes: number | null;
  meeting_url: string | null;
  material_url: string | null;
  is_recurring: boolean;
  client_id: string | null;
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
  client_id: string;
  status: "pending" | "delivered" | "missed";
  delivered_at: string | null;
  delivery_method: string | null;
  notes: string | null;
}

interface ClientAttendance {
  id: string;
  event_id: string;
  client_id: string;
  join_time: string;
}

interface ClientEventParticipation {
  id: string;
  event_id: string;
  client_id: string;
  rsvp_status: string;
  rsvp_responded_at: string | null;
  invited_at: string | null;
  events: {
    id: string;
    title: string;
    scheduled_at: string | null;
    modality: string;
  } | null;
}

interface ClientEventFeedback {
  id: string;
  event_id: string;
  client_id: string;
  nps_score: number | null;
  overall_rating: number | null;
  submitted_at: string;
  events: {
    id: string;
    title: string;
    scheduled_at: string | null;
  } | null;
}

interface ClientAgendaProps {
  clientId: string;
  clientProductIds: string[];
}

export function ClientAgenda({ clientId, clientProductIds }: ClientAgendaProps) {
  // Use linked clients hook for data isolation (couples/linked profiles)
  const { linkedClientIds, linkedClients, isLoading: linkedLoading } = useLinkedClients(clientId);
  
  const [events, setEvents] = useState<EventWithProducts[]>([]);
  const [deliveries, setDeliveries] = useState<ClientDelivery[]>([]);
  const [attendances, setAttendances] = useState<ClientAttendance[]>([]);
  const [participations, setParticipations] = useState<ClientEventParticipation[]>([]);
  const [feedbacks, setFeedbacks] = useState<ClientEventFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    fetchAccountId();
  }, []);

  // Wait for linkedClientIds before fetching data
  useEffect(() => {
    if (accountId && linkedClientIds.length > 0) {
      fetchEvents();
      fetchDeliveries();
      fetchAttendances();
      fetchParticipations();
      fetchFeedbacks();
    }
  }, [accountId, clientProductIds, clientId, linkedClientIds]);

  const fetchAccountId = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        console.error("Usuário não autenticado");
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();
      
      if (error) {
        console.error("Erro ao buscar account_id:", error);
        setLoading(false);
        return;
      }
      
      if (data) {
        setAccountId(data.account_id);
      } else {
        console.error("Perfil de usuário não encontrado");
        setLoading(false);
      }
    } catch (err) {
      console.error("Erro ao buscar accountId:", err);
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    
    try {
      // FIXED: Only fetch events where this client (or linked clients) has deliveries
      // This ensures proper data isolation per client
      const { data: clientDeliveryEventIds } = await supabase
        .from("client_event_deliveries")
        .select("event_id")
        .in("client_id", linkedClientIds);

      const { data: clientAttendanceEventIds } = await supabase
        .from("attendance")
        .select("event_id")
        .in("client_id", linkedClientIds)
        .not("event_id", "is", null);

      // Get unique event IDs from both sources
      const eventIdsFromDeliveries = (clientDeliveryEventIds || []).map(d => d.event_id);
      const eventIdsFromAttendances = (clientAttendanceEventIds || []).map(a => a.event_id).filter(Boolean);
      
      // Also get events linked to client's products (for events they haven't participated yet)
      const { data: productEvents } = await supabase
        .from("events")
        .select(`
          id,
          event_products (product_id)
        `)
        .is("client_id", null)
        .order("scheduled_at", { ascending: true, nullsFirst: false });

      const eventIdsFromProducts = (productEvents || [])
        .filter((event: any) => {
          if (!event.event_products || event.event_products.length === 0) return false;
          return event.event_products.some((ep: any) => 
            clientProductIds.includes(ep.product_id)
          );
        })
        .map((event: any) => event.id);

      // Fetch individual events for this client (client_id set)
      const { data: individualEvents } = await supabase
        .from("events")
        .select("id")
        .in("client_id", linkedClientIds);

      const eventIdsFromIndividual = (individualEvents || []).map(e => e.id);

      // Combine all unique event IDs
      const allEventIds = [...new Set([
        ...eventIdsFromDeliveries,
        ...eventIdsFromAttendances,
        ...eventIdsFromProducts,
        ...eventIdsFromIndividual,
      ])];

      if (allEventIds.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("events")
        .select(`
          *,
          event_products (product_id)
        `)
        .in("id", allEventIds)
        .order("scheduled_at", { ascending: true, nullsFirst: false });

      if (error) {
        console.error("Error fetching events:", error);
        setEvents([]);
      } else {
        setEvents((data || []) as EventWithProducts[]);
      }
    } catch (err) {
      console.error("Exception fetching events:", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Filter by linkedClientIds for proper data isolation
  const fetchDeliveries = async () => {
    const { data, error } = await supabase
      .from("client_event_deliveries")
      .select("*")
      .in("client_id", linkedClientIds);

    if (!error) {
      setDeliveries((data || []) as ClientDelivery[]);
    }
  };

  // FIXED: Filter by linkedClientIds for proper data isolation
  const fetchAttendances = async () => {
    const { data, error } = await supabase
      .from("attendance")
      .select("id, event_id, client_id, join_time")
      .in("client_id", linkedClientIds)
      .not("event_id", "is", null);

    if (!error) {
      setAttendances((data || []) as ClientAttendance[]);
    }
  };

  // FIXED: Filter by linkedClientIds for proper data isolation
  const fetchParticipations = async () => {
    const { data, error } = await supabase
      .from("event_participants")
      .select(`
        id,
        event_id,
        client_id,
        rsvp_status,
        rsvp_responded_at,
        invited_at,
        events (id, title, scheduled_at, modality)
      `)
      .in("client_id", linkedClientIds)
      .order("invited_at", { ascending: false });

    if (!error) {
      setParticipations((data || []) as ClientEventParticipation[]);
    }
  };

  // FIXED: Filter by linkedClientIds for proper data isolation
  const fetchFeedbacks = async () => {
    const { data, error } = await supabase
      .from("event_feedback")
      .select(`
        id,
        event_id,
        client_id,
        nps_score,
        overall_rating,
        submitted_at,
        events (id, title, scheduled_at)
      `)
      .in("client_id", linkedClientIds)
      .order("submitted_at", { ascending: false });

    if (!error) {
      setFeedbacks((data || []) as ClientEventFeedback[]);
    }
  };

  const getDeliveryStatus = (eventId: string): ClientDelivery | undefined => {
    return deliveries.find((d) => d.event_id === eventId);
  };

  const getAttendanceStatus = (eventId: string): ClientAttendance | undefined => {
    return attendances.find((a) => a.event_id === eventId);
  };

  // FIXED: Use original clientId (not linked) for creating new deliveries
  const toggleDelivery = async (eventId: string, currentStatus?: string) => {
    if (!accountId) return;

    const delivery = getDeliveryStatus(eventId);
    
    if (delivery) {
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
      // Use the CURRENT clientId for new deliveries, not linked ones
      const { error } = await supabase
        .from("client_event_deliveries")
        .insert({
          account_id: accountId,
          client_id: clientId, // Always use the current client's ID
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

  if (loading || linkedLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Carregando agenda...
      </div>
    );
  }

  // Helper to get event type label and icon
  const getEventTypeInfo = (eventType: EventType) => {
    const typeMap: Record<EventType, { label: string; icon: React.ReactNode }> = {
      live: { label: "Live", icon: <Video className="h-3 w-3 mr-1" /> },
      material: { label: "Material", icon: <FileText className="h-3 w-3 mr-1" /> },
      mentoria: { label: "Mentoria", icon: <Users className="h-3 w-3 mr-1" /> },
      workshop: { label: "Workshop", icon: <Monitor className="h-3 w-3 mr-1" /> },
      masterclass: { label: "Masterclass", icon: <Video className="h-3 w-3 mr-1" /> },
      webinar: { label: "Webinar", icon: <Monitor className="h-3 w-3 mr-1" /> },
      imersao: { label: "Imersão", icon: <Calendar className="h-3 w-3 mr-1" /> },
      plantao: { label: "Plantão", icon: <Clock className="h-3 w-3 mr-1" /> },
      launch: { label: "Lançamento", icon: <Calendar className="h-3 w-3 mr-1" /> },
      campaign: { label: "Campanha", icon: <Calendar className="h-3 w-3 mr-1" /> },
      content: { label: "Conteúdo", icon: <FileText className="h-3 w-3 mr-1" /> },
      partnership: { label: "Parceria", icon: <Users className="h-3 w-3 mr-1" /> },
      fair: { label: "Feira", icon: <Calendar className="h-3 w-3 mr-1" /> },
      movimento: { label: "Movimento", icon: <Calendar className="h-3 w-3 mr-1" /> },
      viagem: { label: "Viagem", icon: <Calendar className="h-3 w-3 mr-1" /> },
      autoridade: { label: "Autoridade", icon: <Calendar className="h-3 w-3 mr-1" /> },
      other: { label: "Outro", icon: <Calendar className="h-3 w-3 mr-1" /> },
    };
    return typeMap[eventType] || typeMap.live;
  };

  // Separate individual vs shared events
  const individualEvents = events.filter((e) => e.client_id !== null);
  const sharedEvents = events.filter((e) => e.client_id === null);

  // Separate shared events by status
  const upcomingEvents = sharedEvents.filter(
    (e) => e.scheduled_at && (isFuture(new Date(e.scheduled_at)) || isToday(new Date(e.scheduled_at)))
  );
  const pastEvents = sharedEvents.filter(
    (e) => e.scheduled_at && isPast(new Date(e.scheduled_at)) && !isToday(new Date(e.scheduled_at))
  );
  const materialsEvents = sharedEvents.filter((e) => e.event_type === "material");

  const handleEditEvent = (event: EventWithProducts) => {
    const eventData: EventData = {
      id: event.id,
      title: event.title,
      description: event.description,
      event_type: event.event_type,
      modality: event.modality,
      address: event.address,
      scheduled_at: event.scheduled_at,
      ends_at: event.ends_at,
      duration_minutes: event.duration_minutes,
      meeting_url: event.meeting_url,
      material_url: event.material_url,
      is_recurring: event.is_recurring,
      event_products: event.event_products.map(ep => ({
        product_id: ep.product_id,
        products: { id: ep.product_id, name: "" }
      })),
      client_id: event.client_id,
    };
    setEditingEvent(eventData);
    setEditDialogOpen(true);
  };

  const handleCreateIndividualEvent = () => {
    setCreateDialogOpen(true);
  };

  // Helper to get linked client name for badges
  const getLinkedBadge = (itemClientId: string) => {
    const linkedName = getLinkedClientName(itemClientId, clientId, linkedClients);
    if (!linkedName) return null;
    return (
      <Badge variant="outline" className="text-xs ml-2 bg-purple-500/10 text-purple-600 border-purple-500/30">
        Via {linkedName.split(" ")[0]}
      </Badge>
    );
  };

  const renderEventTable = (eventsList: EventWithProducts[], title: string, icon: React.ReactNode, showParticipation?: boolean) => {
    if (eventsList.length === 0) return null;

    return (
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          {icon}
          {title}
        </h3>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {showParticipation && <TableHead className="w-12"></TableHead>}
                <TableHead>Evento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Data/Hora</TableHead>
                {showParticipation && <TableHead>Status</TableHead>}
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventsList.map((event) => {
                const delivery = getDeliveryStatus(event.id);
                const isDelivered = delivery?.status === "delivered";
                const attendance = getAttendanceStatus(event.id);
                const hasCheckedIn = !!attendance;
                const participated = isDelivered || hasCheckedIn;
                const isPresencial = event.modality === "presencial";
                const eventTypeInfo = getEventTypeInfo(event.event_type);
                const isTodayEvent = event.scheduled_at && isToday(new Date(event.scheduled_at));
                const hasLink = event.meeting_url || event.material_url;

                // Format date properly - scheduled_at is stored as UTC timestamp
                const formatEventDate = (dateString: string | null) => {
                  if (!dateString) return "-";
                  const date = new Date(dateString);
                  return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
                };

                return (
                  <TableRow 
                    key={event.id}
                    className={cn(
                      isTodayEvent && "bg-primary/5",
                      showParticipation && participated && "bg-emerald-500/5"
                    )}
                  >
                    {showParticipation && (
                      <TableCell>
                        <Checkbox
                          checked={participated}
                          onCheckedChange={() => toggleDelivery(event.id, delivery?.status)}
                          disabled={hasCheckedIn && !isDelivered}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{event.title}</span>
                        {event.client_id !== null ? (
                          <Badge className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30" variant="outline">
                            Individual
                          </Badge>
                        ) : (
                          <Badge className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30" variant="outline">
                            Compartilhado
                          </Badge>
                        )}
                        {isTodayEvent && (
                          <Badge variant="default" className="text-xs">Hoje</Badge>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {event.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={event.event_type === "material" ? "secondary" : "default"}>
                        {eventTypeInfo.icon}
                        {eventTypeInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline">
                          {isPresencial ? (
                            <><MapPin className="h-3 w-3 mr-1" /> Presencial</>
                          ) : (
                            <><Monitor className="h-3 w-3 mr-1" /> Online</>
                          )}
                        </Badge>
                        {isPresencial && event.address && (
                          <p className="text-xs text-muted-foreground line-clamp-1 max-w-[120px]">
                            {event.address}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {event.scheduled_at ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {formatEventDate(event.scheduled_at)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    {showParticipation && (
                      <TableCell>
                        {hasCheckedIn ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                            <QrCode className="h-3 w-3 mr-1" />
                            Check-in
                          </Badge>
                        ) : isDelivered ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                            <Check className="h-3 w-3 mr-1" />
                            Participou
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Não participou
                          </Badge>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {hasLink && (
                          <Button variant="ghost" size="icon" asChild>
                            <a
                              href={event.meeting_url || event.material_url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir link"
                            >
                              <LinkIcon className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEditEvent(event)}
                          title="Editar evento"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {event.client_id === null && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/events`} title="Ver na página de Eventos">
                              <LinkIcon className="h-3 w-3 mr-1" />
                              Ver
                            </Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const statusColors: Record<string, string> = {
    confirmed: "bg-green-500/10 text-green-600 border-green-500/30",
    declined: "bg-red-500/10 text-red-600 border-red-500/30",
    pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
    attended: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    no_show: "bg-gray-500/10 text-gray-500 border-gray-500/30",
    waitlist: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  };
  const statusLabels: Record<string, string> = {
    confirmed: "Confirmado",
    declined: "Recusado",
    pending: "Pendente",
    attended: "Presente",
    no_show: "Não Compareceu",
    waitlist: "Lista de Espera",
  };

  return (
    <div className="space-y-6">
      {/* Button to create individual event */}
      <div className="flex justify-end">
        <Button onClick={handleCreateIndividualEvent} size="sm" className="gap-2" disabled={!accountId}>
          <Plus className="h-4 w-4" />
          Novo Evento Individual
        </Button>
      </div>

      {/* SECTION 1: Client Event Invitations (RSVPs) - ALWAYS VISIBLE */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Convites para Eventos
        </h3>
        
        {participations.length > 0 ? (
          <div className="grid gap-3">
            {participations.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center">
                    <p className="font-medium truncate">{p.events?.title || "Evento"}</p>
                    {getLinkedBadge(p.client_id)}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {p.events?.scheduled_at 
                        ? format(new Date(p.events.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                        : "Data não definida"}
                    </span>
                    {p.invited_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Convidado em {format(new Date(p.invited_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <Badge className={statusColors[p.rsvp_status] || "bg-muted"}>
                    {statusLabels[p.rsvp_status] || p.rsvp_status}
                  </Badge>
                  {p.rsvp_responded_at && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Resp. {format(new Date(p.rsvp_responded_at), "dd/MM", { locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/10">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum convite de evento registrado</p>
          </div>
        )}
      </div>

      {/* SECTION 2: Individual Events - EDITABLE */}
      <div className="border-t pt-6">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Eventos Individuais
        </h3>
        {individualEvents.length > 0 ? (
          <div className="space-y-6">
            {renderEventTable(individualEvents, "Eventos deste Cliente", <Users className="h-4 w-4" />, true)}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/10">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum evento individual criado para este cliente.</p>
            <p className="text-xs mt-1">Clique em "Novo Evento Individual" para criar.</p>
          </div>
        )}
      </div>

      {/* SECTION 3: Delivery Schedule (shared/product events) - READ ONLY */}
      {clientProductIds.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Package className="h-4 w-4" />
            Agenda de Entregas (Compartilhados)
          </h3>
          {sharedEvents.length > 0 ? (
            <div className="space-y-6">
              {renderEventTable(upcomingEvents, "Próximos Eventos", <Calendar className="h-4 w-4" />, true)}
              {renderEventTable(materialsEvents, "Materiais de Apoio", <FileText className="h-4 w-4" />, true)}
              {renderEventTable(pastEvents, "Eventos Passados", <Clock className="h-4 w-4" />, true)}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/10">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum evento programado para os produtos deste cliente.</p>
              <p className="text-xs mt-1">
                Eventos são criados na{" "}
                <Link to="/events" className="text-primary underline hover:no-underline">
                  página de Eventos
                </Link>.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Client Feedbacks */}
      {feedbacks.length > 0 && (
        <div className="border-t pt-6 mt-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Feedbacks Enviados
          </h3>
          <div className="grid gap-3">
            {feedbacks.map((f) => (
              <div key={f.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div>
                  <div className="flex items-center">
                    <p className="font-medium">{f.events?.title || "Evento"}</p>
                    {getLinkedBadge(f.client_id)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enviado em {format(new Date(f.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {f.nps_score !== null && (
                    <div className="text-center">
                      <p className={cn(
                        "text-lg font-bold",
                        f.nps_score >= 9 ? "text-green-600" : f.nps_score >= 7 ? "text-yellow-600" : "text-red-600"
                      )}>
                        {f.nps_score}
                      </p>
                      <p className="text-xs text-muted-foreground">NPS</p>
                    </div>
                  )}
                  {f.overall_rating !== null && (
                    <div className="text-center">
                      <p className="text-lg font-bold text-primary">{f.overall_rating}★</p>
                      <p className="text-xs text-muted-foreground">Avaliação</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Client Tasks Section */}
      <div className="border-t pt-6 mt-6">
        <ClientTasks clientId={clientId} />
      </div>

      {/* Event Edit Dialog */}
      <EventEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        event={editingEvent}
        onSuccess={fetchEvents}
      />

      {/* Individual Event Creation Dialog */}
      {accountId && (
        <ClientIndividualEventDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          clientId={clientId}
          accountId={accountId}
          onSuccess={fetchEvents}
        />
      )}
    </div>
  );
}
