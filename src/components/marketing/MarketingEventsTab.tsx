import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuditLog } from "@/hooks/useAuditLog";
import { QRCodeSVG } from "qrcode.react";
import { 
  Plus, 
  Calendar, 
  Video, 
  FileText, 
  Pencil, 
  Trash2, 
  Clock,
  Link as LinkIcon,
  Package,
  Monitor,
  MapPin,
  QrCode,
  Copy,
  Check,
  Users,
  Download,
  BarChart3,
  Megaphone,
  Rocket,
  Handshake,
  Radio,
  Building,
  Presentation,
} from "lucide-react";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AttendanceReport from "@/components/events/AttendanceReport";

interface Attendance {
  id: string;
  client_id: string;
  join_time: string;
  clients: {
    id: string;
    full_name: string;
    phone_e164: string;
    avatar_url: string | null;
  };
}

type MarketingEventType = "launch" | "campaign" | "webinar" | "content" | "live" | "partnership" | "fair" | "workshop" | "other";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  modality: "online" | "presencial";
  address: string | null;
  scheduled_at: string | null;
  ends_at: string | null;
  duration_minutes: number | null;
  meeting_url: string | null;
  material_url: string | null;
  is_recurring: boolean;
  checkin_code: string | null;
  category: "marketing" | "operation";
  color: string | null;
  goals: string | null;
  notes: string | null;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
}

interface EventProduct {
  product_id: string;
  products: Product;
}

interface EventWithProducts extends Event {
  event_products: EventProduct[];
}

const eventTypeConfig: Record<MarketingEventType, { label: string; icon: React.ReactNode; defaultColor: string }> = {
  launch: { label: 'Lançamento', icon: <Rocket className="h-4 w-4" />, defaultColor: '#ef4444' },
  campaign: { label: 'Campanha', icon: <Megaphone className="h-4 w-4" />, defaultColor: '#f97316' },
  webinar: { label: 'Webinar', icon: <Video className="h-4 w-4" />, defaultColor: '#8b5cf6' },
  content: { label: 'Conteúdo', icon: <FileText className="h-4 w-4" />, defaultColor: '#06b6d4' },
  live: { label: 'Live', icon: <Radio className="h-4 w-4" />, defaultColor: '#ec4899' },
  partnership: { label: 'Parceria', icon: <Handshake className="h-4 w-4" />, defaultColor: '#10b981' },
  fair: { label: 'Feira/Congresso', icon: <Building className="h-4 w-4" />, defaultColor: '#6366f1' },
  workshop: { label: 'Workshop', icon: <Presentation className="h-4 w-4" />, defaultColor: '#eab308' },
  other: { label: 'Outro', icon: <Calendar className="h-4 w-4" />, defaultColor: '#64748b' },
};

export default function MarketingEventsTab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { logAudit } = useAuditLog();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithProducts | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedEventForQr, setSelectedEventForQr] = useState<EventWithProducts | null>(null);
  const [copied, setCopied] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [selectedEventForAttendance, setSelectedEventForAttendance] = useState<EventWithProducts | null>(null);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEventType, setFilterEventType] = useState<string>("all");
  const [filterModality, setFilterModality] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [modalityTab, setModalityTab] = useState<"all" | "presencial" | "online">("all");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<MarketingEventType>("campaign");
  const [modality, setModality] = useState<"online" | "presencial">("online");
  const [address, setAddress] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [color, setColor] = useState("#f97316");
  const [goals, setGoals] = useState("");
  const [notes, setNotes] = useState("");
  
  // Multi-day schedule state
  const [daySchedules, setDaySchedules] = useState<Record<string, { startTime: string; endTime: string }>>({});

  // Fetch account ID
  const { data: accountId } = useQuery({
    queryKey: ["user-account-id", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", user?.id)
        .single();
      return data?.account_id || null;
    },
    enabled: !!user?.id,
    staleTime: 300000,
  });

  // Fetch all events (marketing and operation)
  const { data: events = [], isLoading: loading } = useQuery({
    queryKey: ["all-events-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(`
          *,
          event_products (
            product_id,
            products (id, name)
          )
        `)
        .in("category", ["marketing", "operation"])
        .order("scheduled_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data as EventWithProducts[]) || [];
    },
    staleTime: 30000,
  });

  // Fetch attendance for selected event
  const { data: attendance = [] } = useQuery({
    queryKey: ["event-attendance", selectedEventForAttendance?.id],
    queryFn: async () => {
      if (!selectedEventForAttendance?.id) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select(`
          id,
          client_id,
          join_time,
          clients (id, full_name, phone_e164, avatar_url)
        `)
        .eq("event_id", selectedEventForAttendance.id)
        .order("join_time", { ascending: true });
      if (error) throw error;
      return (data as Attendance[]) || [];
    },
    enabled: !!selectedEventForAttendance?.id,
  });

  const invalidateEvents = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["marketing-events-list"] });
    queryClient.invalidateQueries({ queryKey: ["events"] });
  }, [queryClient]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setEventType("campaign");
    setModality("online");
    setAddress("");
    setScheduledAt("");
    setEndsAt("");
    setIsMultiDay(false);
    setDurationMinutes("");
    setMeetingUrl("");
    setColor("#f97316");
    setGoals("");
    setNotes("");
    setDaySchedules({});
    setEditingEvent(null);
  };

  const openAttendanceDialog = (event: EventWithProducts) => {
    setSelectedEventForAttendance(event);
    setAttendanceDialogOpen(true);
  };

  const exportAttendanceCSV = () => {
    if (!selectedEventForAttendance || attendance.length === 0) return;

    const headers = ["Nome", "Telefone", "Hora do Check-in"];
    const rows = attendance.map((a) => [
      a.clients.full_name,
      a.clients.phone_e164,
      format(new Date(a.join_time), "dd/MM/yyyy HH:mm", { locale: ptBR })
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `presencas-${selectedEventForAttendance.title.replace(/\s+/g, "-")}.csv`;
    link.click();
  };

  const openEditDialog = (event: EventWithProducts) => {
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description || "");
    setEventType(event.event_type as MarketingEventType);
    setModality(event.modality || "online");
    setAddress(event.address || "");
    setScheduledAt(event.scheduled_at ? event.scheduled_at.slice(0, 16) : "");
    setEndsAt(event.ends_at ? event.ends_at.slice(0, 16) : "");
    setIsMultiDay(!!event.ends_at);
    setDurationMinutes(event.duration_minutes?.toString() || "");
    setMeetingUrl(event.meeting_url || "");
    setColor(event.color || "#f97316");
    setGoals(event.goals || "");
    setNotes(event.notes || "");
    setDaySchedules({});
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    if (!accountId) {
      toast.error("Conta não encontrada");
      return;
    }

    const generateCheckinCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    const eventData: any = {
      title: title.trim(),
      description: description.trim() || null,
      event_type: eventType,
      modality: modality,
      address: modality === "presencial" ? address.trim() || null : null,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      ends_at: isMultiDay && endsAt ? new Date(endsAt).toISOString() : null,
      duration_minutes: !isMultiDay && durationMinutes ? parseInt(durationMinutes) : null,
      meeting_url: meetingUrl.trim() || null,
      category: "marketing",
      color: color,
      goals: goals.trim() || null,
      notes: notes.trim() || null,
      account_id: accountId,
    };

    if (!editingEvent && modality === "presencial") {
      eventData.checkin_code = generateCheckinCode();
    }

    let eventId: string;

    if (editingEvent) {
      const { error } = await supabase
        .from("events")
        .update(eventData)
        .eq("id", editingEvent.id);

      if (error) {
        toast.error("Não foi possível atualizar o evento");
        return;
      }
      eventId = editingEvent.id;
    } else {
      const { data, error } = await supabase
        .from("events")
        .insert(eventData)
        .select("id")
        .single();

      if (error || !data) {
        toast.error("Não foi possível criar o evento");
        return;
      }
      eventId = data.id;
    }

    logAudit({
      action: editingEvent ? "update" : "create",
      entityType: "event",
      entityId: eventId,
      entityName: title.trim(),
      details: { event_type: eventType, modality, category: "marketing" }
    });

    toast.success(editingEvent ? "Evento atualizado" : "Evento criado");

    setDialogOpen(false);
    resetForm();
    invalidateEvents();
  };

  const handleDelete = async (id: string) => {
    const eventToDelete = events.find(e => e.id === id);
    
    const { error } = await supabase.from("events").delete().eq("id", id);

    if (error) {
      toast.error("Não foi possível excluir o evento");
    } else {
      logAudit({
        action: "delete",
        entityType: "event",
        entityId: id,
        entityName: eventToDelete?.title || "Evento",
      });
      
      toast.success("Evento excluído");
      invalidateEvents();
    }
  };

  const openQrDialog = (event: EventWithProducts) => {
    setSelectedEventForQr(event);
    setQrDialogOpen(true);
  };

  const copyCheckinLink = async (code: string) => {
    const link = `${window.location.origin}/event-checkin/${code}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copiado!");
  };

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch = 
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterEventType === "all" || event.event_type === filterEventType;
      const matchesModality = filterModality === "all" || event.modality === filterModality;
      const matchesCategory = filterCategory === "all" || event.category === filterCategory;
      const matchesModalityTab = modalityTab === "all" || event.modality === modalityTab;
      
      return matchesSearch && matchesType && matchesModality && matchesCategory && matchesModalityTab;
    });
  }, [events, searchTerm, filterEventType, filterModality, filterCategory, modalityTab]);

  const presencialCount = events.filter(e => e.modality === "presencial").length;
  const onlineCount = events.filter(e => e.modality === "online").length;
  const marketingCount = events.filter(e => e.category === "marketing").length;
  const operationCount = events.filter(e => e.category === "operation").length;

  const hasActiveFilters = filterEventType !== "all" || filterModality !== "all" || filterCategory !== "all";

  const clearFilters = () => {
    setFilterEventType("all");
    setFilterModality("all");
    setFilterCategory("all");
  };

  const getTypeInfo = (type: string) => {
    return eventTypeConfig[type as MarketingEventType] || eventTypeConfig.other;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex-1">
          <Input
            placeholder="Buscar eventos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Evento
        </Button>
      </div>

      {/* Modality tabs */}
      <Tabs value={modalityTab} onValueChange={(v) => setModalityTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">
            Todos ({events.length})
          </TabsTrigger>
          <TabsTrigger value="presencial">
            <MapPin className="h-4 w-4 mr-1" />
            Presencial ({presencialCount})
          </TabsTrigger>
          <TabsTrigger value="online">
            <Monitor className="h-4 w-4 mr-1" />
            Online ({onlineCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as áreas</SelectItem>
            <SelectItem value="marketing">Marketing ({marketingCount})</SelectItem>
            <SelectItem value="operation">Operação ({operationCount})</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEventType} onValueChange={setFilterEventType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(eventTypeConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Events table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum evento encontrado</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEvents.map((event) => {
                  const typeInfo = getTypeInfo(event.event_type);
                  return (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-2 h-8 rounded-full"
                            style={{ backgroundColor: event.color || typeInfo.defaultColor }}
                          />
                          <div>
                            <p className="font-medium">{event.title}</p>
                            {event.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {event.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={event.category === "marketing" ? "default" : "secondary"}
                          className={event.category === "marketing" 
                            ? "bg-orange-500 hover:bg-orange-600 text-white" 
                            : "bg-blue-500 hover:bg-blue-600 text-white"
                          }
                        >
                          {event.category === "marketing" ? "MARKETING" : "OPERAÇÃO"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          style={{ 
                            borderColor: event.color || typeInfo.defaultColor,
                            color: event.color || typeInfo.defaultColor 
                          }}
                        >
                          {typeInfo.icon}
                          <span className="ml-1">{typeInfo.label}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {event.scheduled_at ? (
                          <div className="text-sm">
                            <p>{format(new Date(event.scheduled_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(event.scheduled_at), "HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={event.modality === "presencial" ? "default" : "secondary"}>
                          {event.modality === "presencial" ? (
                            <><MapPin className="h-3 w-3 mr-1" /> Presencial</>
                          ) : (
                            <><Monitor className="h-3 w-3 mr-1" /> Online</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {event.modality === "presencial" && event.checkin_code && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openQrDialog(event)}
                                  >
                                    <QrCode className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>QR Code Check-in</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openAttendanceDialog(event)}
                                >
                                  <Users className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Presenças</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => navigate(`/events/${event.id}`)}
                                >
                                  <BarChart3 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Detalhes</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(event)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(event.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Editar Evento" : "Novo Evento de Marketing"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nome do evento"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={eventType} onValueChange={(v) => {
                  setEventType(v as MarketingEventType);
                  setColor(eventTypeConfig[v as MarketingEventType].defaultColor);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(eventTypeConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Modalidade</Label>
                <Select value={modality} onValueChange={(v) => setModality(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="presencial">Presencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {modality === "presencial" && (
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Local do evento"
                />
              </div>
            )}

            {modality === "online" && (
              <div className="space-y-2">
                <Label>Link da Reunião</Label>
                <Input
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data/Hora Início</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Data/Hora Fim</Label>
                <Input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-9 p-1 cursor-pointer"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição do evento..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Objetivos</Label>
              <Textarea
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="Objetivos do evento..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas internas..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!title.trim()}>
              {editingEvent ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code Check-in</DialogTitle>
          </DialogHeader>
          {selectedEventForQr && (
            <div className="flex flex-col items-center gap-4">
              <QRCodeSVG
                value={`${window.location.origin}/event-checkin/${selectedEventForQr.checkin_code}`}
                size={200}
              />
              <p className="text-sm text-muted-foreground text-center">
                {selectedEventForQr.title}
              </p>
              <Button
                variant="outline"
                onClick={() => copyCheckinLink(selectedEventForQr.checkin_code!)}
              >
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copiado!" : "Copiar Link"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Attendance Dialog */}
      <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Presenças - {selectedEventForAttendance?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedEventForAttendance && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {attendance.length} participante(s)
                </p>
                {attendance.length > 0 && (
                  <Button variant="outline" size="sm" onClick={exportAttendanceCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                )}
              </div>

              {attendance.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Nenhuma presença registrada
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participante</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Check-in</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={a.clients.avatar_url || undefined} />
                              <AvatarFallback>
                                {a.clients.full_name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{a.clients.full_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{a.clients.phone_e164}</TableCell>
                        <TableCell>
                          {format(new Date(a.join_time), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
