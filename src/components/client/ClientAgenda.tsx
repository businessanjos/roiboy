import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Video,
  FileText,
  Calendar,
  Clock,
  Check,
  X,
  ExternalLink,
  Package,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  QrCode,
} from "lucide-react";
import { ClientTasks } from "./ClientTasks";
import { format, isPast, isFuture, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: "live" | "material";
  modality: "online" | "presencial";
  address: string | null;
  checkin_code: string | null;
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

interface ClientAttendance {
  id: string;
  event_id: string;
  join_time: string;
}

interface ClientAgendaProps {
  clientId: string;
  clientProductIds: string[];
}

export function ClientAgenda({ clientId, clientProductIds }: ClientAgendaProps) {
  const [events, setEvents] = useState<EventWithProducts[]>([]);
  const [deliveries, setDeliveries] = useState<ClientDelivery[]>([]);
  const [attendances, setAttendances] = useState<ClientAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithProducts | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<EventWithProducts | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    event_type: "live" as "live" | "material",
    scheduled_at: "",
    duration_minutes: "60",
    meeting_url: "",
    material_url: "",
  });

  useEffect(() => {
    fetchAccountId();
  }, []);

  useEffect(() => {
    if (accountId) {
      fetchEvents();
      fetchDeliveries();
      fetchAttendances();
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

  const fetchAttendances = async () => {
    const { data, error } = await supabase
      .from("attendance")
      .select("id, event_id, join_time")
      .eq("client_id", clientId)
      .not("event_id", "is", null);

    if (!error) {
      setAttendances((data || []) as ClientAttendance[]);
    }
  };

  const getDeliveryStatus = (eventId: string): ClientDelivery | undefined => {
    return deliveries.find((d) => d.event_id === eventId);
  };

  const getAttendanceStatus = (eventId: string): ClientAttendance | undefined => {
    return attendances.find((a) => a.event_id === eventId);
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

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      event_type: "live",
      scheduled_at: "",
      duration_minutes: "60",
      meeting_url: "",
      material_url: "",
    });
    setEditingEvent(null);
  };

  const openEditDialog = (event: EventWithProducts) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || "",
      event_type: event.event_type,
      scheduled_at: event.scheduled_at ? event.scheduled_at.slice(0, 16) : "",
      duration_minutes: event.duration_minutes?.toString() || "60",
      meeting_url: event.meeting_url || "",
      material_url: event.material_url || "",
    });
    setDialogOpen(true);
  };

  const handleCreateEvent = async () => {
    if (!accountId || !formData.title.trim()) {
      toast.error("Preencha o título do evento");
      return;
    }

    if (clientProductIds.length === 0) {
      toast.error("Cliente não possui produtos vinculados");
      return;
    }

    setSubmitting(true);

    try {
      // Create event
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .insert({
          account_id: accountId,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          event_type: formData.event_type,
          scheduled_at: formData.scheduled_at || null,
          duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
          meeting_url: formData.meeting_url.trim() || null,
          material_url: formData.material_url.trim() || null,
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Link to client's products
      const eventProductsInserts = clientProductIds.map((productId) => ({
        account_id: accountId,
        event_id: eventData.id,
        product_id: productId,
      }));

      const { error: linkError } = await supabase
        .from("event_products")
        .insert(eventProductsInserts);

      if (linkError) throw linkError;

      toast.success("Evento criado com sucesso!");
      resetForm();
      setDialogOpen(false);
      fetchEvents();
    } catch (error) {
      console.error("Error creating event:", error);
      toast.error("Erro ao criar evento");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateEvent = async () => {
    if (!accountId || !editingEvent || !formData.title.trim()) {
      toast.error("Preencha o título do evento");
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from("events")
        .update({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          event_type: formData.event_type,
          scheduled_at: formData.scheduled_at || null,
          duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
          meeting_url: formData.meeting_url.trim() || null,
          material_url: formData.material_url.trim() || null,
        })
        .eq("id", editingEvent.id);

      if (error) throw error;

      toast.success("Evento atualizado com sucesso!");
      resetForm();
      setDialogOpen(false);
      fetchEvents();
    } catch (error) {
      console.error("Error updating event:", error);
      toast.error("Erro ao atualizar evento");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;

    try {
      // First delete event_products links
      await supabase
        .from("event_products")
        .delete()
        .eq("event_id", eventToDelete.id);

      // Then delete deliveries
      await supabase
        .from("client_event_deliveries")
        .delete()
        .eq("event_id", eventToDelete.id);

      // Finally delete the event
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", eventToDelete.id);

      if (error) throw error;

      toast.success("Evento excluído com sucesso!");
      setDeleteDialogOpen(false);
      setEventToDelete(null);
      fetchEvents();
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("Erro ao excluir evento");
    }
  };

  const handleSubmit = () => {
    if (editingEvent) {
      handleUpdateEvent();
    } else {
      handleCreateEvent();
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

  const eventDialogContent = (
    <Dialog open={dialogOpen} onOpenChange={(open) => {
      setDialogOpen(open);
      if (!open) resetForm();
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingEvent ? "Editar Evento" : "Criar Evento para Cliente"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="event-title">Título *</Label>
            <Input
              id="event-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Nome do evento"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event_type">Tipo</Label>
            <Select
              value={formData.event_type}
              onValueChange={(value: "live" | "material") => 
                setFormData({ ...formData, event_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="live">Live / Reunião</SelectItem>
                <SelectItem value="material">Material de Apoio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description">Descrição</Label>
            <Textarea
              id="event-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalhes do evento"
              rows={3}
            />
          </div>

          {formData.event_type === "live" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="scheduled_at">Data/Hora</Label>
                  <Input
                    id="scheduled_at"
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duração (min)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="meeting_url">Link da Reunião</Label>
                <Input
                  id="meeting_url"
                  value={formData.meeting_url}
                  onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
                  placeholder="https://zoom.us/..."
                />
              </div>
            </>
          )}

          {formData.event_type === "material" && (
            <div className="space-y-2">
              <Label htmlFor="material_url">Link do Material</Label>
              <Input
                id="material_url"
                value={formData.material_url}
                onChange={(e) => setFormData({ ...formData, material_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (editingEvent ? "Salvando..." : "Criando...") : (editingEvent ? "Salvar" : "Criar Evento")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const deleteDialogContent = (
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir "{eventToDelete?.title}"? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteEvent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (events.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Evento
          </Button>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum evento programado para os produtos deste cliente.</p>
          <p className="text-sm mt-1">Crie eventos usando o botão acima.</p>
        </div>
        {eventDialogContent}
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
      {/* Header with Create Button */}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Novo Evento
        </Button>
      </div>
      
      {eventDialogContent}
      {deleteDialogContent}
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
              const attendance = getAttendanceStatus(event.id);
              const hasCheckedIn = !!attendance;
              const isPresencial = event.modality === "presencial";

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
                        isPresencial ? "bg-sky-500/10 text-sky-500" : event.event_type === "live" ? "bg-indigo-500/10 text-indigo-500" : "bg-amber-500/10 text-amber-500"
                      )}>
                        {isPresencial ? (
                          <MapPin className="h-5 w-5" />
                        ) : event.event_type === "live" ? (
                          <Video className="h-5 w-5" />
                        ) : (
                          <FileText className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{event.title}</p>
                          {isPresencial && (
                            <Badge variant="outline" className="text-sky-600 border-sky-500/30 bg-sky-500/10 text-xs">
                              Presencial
                            </Badge>
                          )}
                        </div>
                        {event.scheduled_at && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(event.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            {event.duration_minutes && ` • ${event.duration_minutes}min`}
                          </p>
                        )}
                        {isPresencial && event.address && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {event.address}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {isToday(new Date(event.scheduled_at!)) && (
                            <Badge variant="default">Hoje</Badge>
                          )}
                          {hasCheckedIn && (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                              <QrCode className="h-3 w-3 mr-1" />
                              Check-in feito
                            </Badge>
                          )}
                        </div>
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
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(event)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            setEventToDelete(event);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(event)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setEventToDelete(event);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
              const attendance = getAttendanceStatus(event.id);
              const hasCheckedIn = !!attendance;
              const participated = isDelivered || hasCheckedIn;
              const isPresencial = event.modality === "presencial";

              return (
                <div
                  key={event.id}
                  className={cn(
                    "border rounded-lg p-3 flex items-center justify-between",
                    participated ? "bg-emerald-500/5 border-emerald-500/20" : "bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={participated}
                      onCheckedChange={() => toggleDelivery(event.id, delivery?.status)}
                      disabled={hasCheckedIn && !isDelivered}
                    />
                    <div className={cn(
                      "w-8 h-8 rounded flex items-center justify-center",
                      participated ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                    )}>
                      {participated ? (
                        hasCheckedIn ? <QrCode className="h-4 w-4" /> : <Check className="h-4 w-4" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          "font-medium",
                          !participated && "text-muted-foreground"
                        )}>
                          {event.title}
                        </p>
                        {isPresencial && (
                          <Badge variant="outline" className="text-sky-600 border-sky-500/30 bg-sky-500/10 text-xs">
                            Presencial
                          </Badge>
                        )}
                      </div>
                      {event.scheduled_at && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(event.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasCheckedIn ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                        <QrCode className="h-3 w-3 mr-1" />
                        Check-in
                      </Badge>
                    ) : isDelivered ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                        Participou
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Não participou
                      </Badge>
                    )}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(event)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setEventToDelete(event);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Client Tasks Section */}
      <div className="border-t pt-6 mt-6">
        <ClientTasks clientId={clientId} />
      </div>
    </div>
  );
}
